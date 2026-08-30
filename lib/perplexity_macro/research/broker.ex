defmodule PerplexityMacro.ResearchBroker do
  use GenServer
  def handle_cast({:request, req}, state) do
    Task.Supervisor.start_child(PerplexityMacro.TaskSupervisor, fn ->
      result = req |> dispatch() |> PerplexityMacro.Evidence.normalize() |> PerplexityMacro.Evidence.encode_tlv()
      GenServer.cast(PerplexityMacro.VM, {:host_result, req.id, result})
    end)
    {:noreply, state}
  end
  defp dispatch(%{capability: :search}=r), do: PerplexityMacro.Adapters.Search.run(r.query)
  defp dispatch(%{capability: :wikipedia}=r), do: PerplexityMacro.Adapters.Wikipedia.run(r.query)
  defp dispatch(%{capability: :mathematica}=r), do: PerplexityMacro.Adapters.Mathematica.run(r.query)
  defp dispatch(%{capability: :dictionary}=r), do: PerplexityMacro.Adapters.Dictionary.run(r.query)
  defp dispatch(r), do: {:ok, []}
end
