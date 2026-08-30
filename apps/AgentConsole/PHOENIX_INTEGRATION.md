# Phoenix LiveView — Agent Console integration

Clean extension: make LiveView the control surface.

## Supervisor

`lib/perplexity_macro/application.ex` — already `ROM + Host`. Extend to `ROM + VM + TraceHub + Endpoint + ToolBroker + WASMBox`:

```elixir
children = [
  PerplexityMacro.ROM,
  PerplexityMacro.VM,               # GenServer fetch/decode/execute
  PerplexityMacro.TraceHub,         # ring 50k + PubSub
  PerplexityMacro.ResearchBroker,   # search/fetch/... + Evidence TLV
  PerplexityMacro.ToolRouter,       # capability router + CONFIRM
  PerplexityMacro.WASMBox,          # Port to Pyodide/Worker or NIF
  PerplexityMacroWeb.Endpoint
]
```

## Mailbox

`lib/perplexity_macro/rom.ex:00 phase 01 fuel 02 cap 03 status, TLV @$46 CRC16 @$C6` — keep. Add `python.execute` as code cap (0x04) routed to WASMBox instead of Adapters.Code.

## Tool Router

```elixir
defmodule PerplexityMacro.ToolRouter do
  # sensitive? from capability.ex → requires CONFIRM 0x2A + expiring token
  def route(%{capability: cap}=req) do
    if PerplexityMacro.Capability.sensitive?(cap) and not confirmed?(req) do
      {:error, :confirm_required}
    else
      case cap do
        :code when req.python? -> PerplexityMacro.WASMBox.exec(req)
        _ -> PerplexityMacro.ResearchBroker.request(req)
      end
    end
  end
end
```

## LiveView

`lib/perplexity_macro_web/live/agent_console_live.ex`:

```elixir
defmodule PerplexityMacroWeb.AgentConsoleLive do
  use Phoenix.LiveView
  def mount(_,_,socket) do
    if connected?(socket), do: Phoenix.PubSub.subscribe(PerplexityMacro.PubSub, "trace")
    {:ok, assign(socket, vm: PerplexityMacro.VM.snapshot(), py: PerplexityMacro.WASMBox.status(), tools: PerplexityMacro.ToolRouter.registry())}
  end
  def handle_info({:retired, trace}, socket), do: {:noreply, stream_insert(socket, :traces, trace, at: 0)}
  def handle_event("instruction", %{"capability"=>cap, "arguments"=>args}, socket) do
    VM.request(cap, args) # -> RQ -> ToolRouter -> VERIFY -> EVIDENCE -> TRACE
    {:noreply, socket}
  end
  def handle_event("python", %{"code"=>code}, socket) do
    VM.request(:code, %{python: true, code: code})
    {:noreply, socket}
  end
end
```

Template is `docs/agent-console/index.html` (same IDs: `#chatLog`, `#traceBody`, `#termOut`). JS hook `phx-hook="AgentConsole"` replaces the mock WS with real Phoenix socket.

## Static fallback (GitHub Pages)

`docs/agent-console/` works without Phoenix — JS mocks broker + VM. When `ws://localhost:4000/socket/websocket` connects, it upgrades to real PubSub streaming (50k ring). Pyodide always runs in browser WASM, mediated through Capability Router in both modes.
