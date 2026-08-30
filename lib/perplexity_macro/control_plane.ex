defmodule PerplexityMacro.ControlPlane do
  @moduledoc """
  Elixir/OTP CONTROL PLANE — top of `Agent Console` stack.

                 Elixir / OTP
                 CONTROL PLANE (this module)
                      │
            ┌─────────┴──────────┐
            ▼                    ▼
     Python workers          Elixir services
     AI / ML / data          concurrency / state
     (Adapters, WASM:         (VM, TraceHub 50k,
      Python execution)        ROM mailbox, ResearchBroker,
                               Phoenix LiveView)
            │                    │
            └──────────┬─────────┘
                       ▼
                   Tool layer
                APIs / WASM / DB
               (Tavily, Wiki, WASM Box,
                Swift Gateway typed JSON)

  Browser WebLLM is the *instruction model* that drives this plane:
    Browser WebLLM ──instruction ABI──> ControlPlane ──> Python workers | Elixir services ──> Tool layer
  ControlPlane owns: fuel, transcript_hash, WORM seal, capability policy (CONFIRM 0x2A),
  and routes `java.execute` → WASM Box vs `tool.call` → local or Swift gateway (optional).
  """
  use GenServer

  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)

  @impl true
  def init(_opts) do
    {:ok, %{python_workers: :pool, elixir_services: %{vm: PerplexityMacro.VM, trace_hub: PerplexityMacro.TraceHub, broker: PerplexityMacro.ResearchBroker},
             gateway_status: :offline, state: %{fuel: 128, transcript_hash: 0, history: []}}}
  end

  # Single entry: instruction ABI {id, op: java.execute|tool.call|vm.execute|final}
  def dispatch(instr), do: GenServer.call(__MODULE__, {:dispatch, instr}, 30_000)
  def gateway_status, do: GenServer.call(__MODULE__, :gateway_status)

  @impl true
  def handle_call({:dispatch, %{op: "java.execute"}=instr}, _from, s) do
    # Route to Python workers when Java/WASM is Python-backed (Pyodide/WASM Box)
    # or to WASM Box when Java/WASM artifact is available — same capability bridge
    result = case PerplexityMacro.WASMBox.execute(instr.code, %{}) do
      {:ok, r} -> r
      {:error, e} -> %{error: inspect(e)}
    end
    tlv = PerplexityMacro.Evidence.encode_tlv(result)
    PerplexityMacro.VM.commit_evidence(tlv)
    {:reply, {:ok, result, s.state}, s}
  end

  def handle_call({:dispatch, %{op: "tool.call"}=instr}, _from, s) do
    # Capability bridge: local → Elixir services | external → Swift gateway (optional) → Tool layer
    cap = instr.name |> String.to_atom()
    route = if PerplexityMacro.Capability.sensitive?(cap) and s.gateway_status == :offline do
      # sensitive caps require gateway or CONFIRM — fallback to local typed mock
      {:local, :mock}
    else
      {:gateway_or_local, cap}
    end
    result = case route do
      {:local, _} -> mock_tool(instr)
      {:gateway_or_local, _} ->
        case PerplexityMacro.ToolRouter.route(%{capability: cap, query: instr.arguments["query"] || ""}) do
          {:ok, tlv} -> tlv
          {:error, :confirm_required} -> %{error: "CONFIRM 0x2A required"}
        end
    end
    tlv = PerplexityMacro.Evidence.encode_tlv(result)
    PerplexityMacro.VM.commit_evidence(tlv)
    {:reply, {:ok, result, s.state}, s}
  end

  def handle_call({:dispatch, %{op: "vm.execute"}}, _from, s), do: {:reply, {:ok, PerplexityMacro.VM.snapshot(), s.state}, s}
  def handle_call({:dispatch, %{op: "final", content: c}}, _from, s), do: {:reply, {:ok, %{final: c}, s.state}, s}
  def handle_call(:gateway_status, _from, s), do: {:reply, s.gateway_status, s}

  defp mock_tool(%{name: name, arguments: args}) do
    %{title: name, url: "#{name}://mock", content: inspect(args), source_hash: :erlang.phash2(args, 0xFFFFFFFF)}
  end
end
