defmodule PerplexityMacroWeb.AgentConsoleLive do
  @moduledoc "Phoenix LiveView — Agent Console control surface. VM owns control, LiveView owns observability."
  use Phoenix.LiveView

  def mount(_params, _session, socket) do
    if connected?(socket), do: Phoenix.PubSub.subscribe(PerplexityMacro.PubSub, "trace")
    {:ok,
     socket
     |> assign(vm: PerplexityMacro.VM.snapshot())
     |> assign(py_status: PerplexityMacro.WASMBox.status())
     |> assign(tools: registry())
     |> stream(:traces, PerplexityMacro.TraceHub.recent(50))
     |> assign(instruction: nil)}
  end

  def handle_event("instruction", %{"capability" => cap, "arguments" => args}, socket) do
    # VM RQ → ToolRouter (CONFIRM gate) → VERIFY → EVIDENCE → TRACE
    instr = %{capability: String.to_atom(cap), query: args["query"] || args["code"] || "", args: args, python: String.starts_with?(cap, "python")}
    case PerplexityMacro.ToolRouter.route(instr) do
      {:ok, tlv} -> PerplexityMacro.VM.commit_evidence(tlv)
      {:error, :confirm_required} -> {:noreply, put_flash(socket, :error, "CONFIRM required for #{cap} (0x2A)")}
    end
    {:noreply, socket}
  end

  def handle_event("confirm", _params, socket) do
    {:ok, tok} = PerplexityMacro.ToolRouter.confirm()
    {:noreply, put_flash(socket, :info, "CONFIRM token #{tok.token} (60s) — one-shot")}
  end

  def handle_event("python", %{"code" => code}, socket) do
    case PerplexityMacro.WASMBox.execute(code) do
      {:ok, res} -> PerplexityMacro.VM.commit_evidence(PerplexityMacro.Evidence.encode_tlv(res))
      {:error, e} -> put_flash(socket, :error, inspect(e))
    end
    {:noreply, socket}
  end

  def handle_info({:retired, trace}, socket), do: {:noreply, stream_insert(socket, :traces, trace, at: 0)}

  defp registry do
    [
      %{id: "search", cap: 0x01, label: "search", sensitive: false},
      %{id: "fetch", cap: 0x02, label: "fetch", sensitive: false},
      %{id: "browser", cap: 0x03, label: "browser", sensitive: true},
      %{id: "code", cap: 0x04, label: "code", sensitive: true},
      %{id: "local_model", cap: 0x05, label: "local_model", sensitive: false},
      %{id: "wikipedia", cap: 0x06, label: "wikipedia", sensitive: true},
      %{id: "mathematica", cap: 0x07, label: "mathematica", sensitive: true},
      %{id: "dictionary", cap: 0x08, label: "dictionary", sensitive: false},
      %{id: "python.execute", cap: 0x04, label: "python.execute", sensitive: false, sandbox: true},
      %{id: "macrogrok.infer4", cap: 0x04, label: "macrogrok.infer4", sensitive: false}
    ]
  end
end
