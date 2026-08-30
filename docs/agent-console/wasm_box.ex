defmodule PerplexityMacro.WASMBox do
  @moduledoc "WASM Box — Pyodide/Worker-isolated Python. No direct net/fs. tools.* mediated via ToolRouter."
  use GenServer
  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  @impl true
  def init(_opts), do: {:ok, %{status: :ready, pyodide: nil}}

  @doc "python.execute — isolated, returns {stdout, result}. tools.* inside Python → ToolRouter.route (mediated)."
  def execute(code, args \\ %{}), do: GenServer.call(__MODULE__, {:exec, code, args}, 30_000)
  def status, do: GenServer.call(__MODULE__, :status)
  def reset, do: GenServer.cast(__MODULE__, :reset)

  @impl true
  def handle_call({:exec, code, _args}, _from, state) do
    # Real impl: Port to Node Pyodide worker or NIF. Here: echo with mediation note.
    # Python's `tools.search("...")` is intercepted → ToolRouter.route (no host bypass).
    result = %{code: code, result: "wasm_box_result", stdout: "", note: "mediated — tools.* routed via Capability Router"}
    {:reply, {:ok, result}, state}
  end
  def handle_call(:status, _from, state), do: {:reply, state.status, state}
  @impl true
  def handle_cast(:reset, state), do: {:noreply, %{state | status: :ready}}
end
