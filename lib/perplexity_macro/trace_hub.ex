defmodule PerplexityMacro.TraceHub do
  use GenServer
  def publish(trace), do: GenServer.cast(__MODULE__, {:trace, trace})
  def subscribe, do: Phoenix.PubSub.subscribe(PerplexityMacro.PubSub, "macro_vm:trace")
  def latest(n), do: GenServer.call(__MODULE__, {:latest, n})
  def init(_), do: {:ok, %{queue: :queue.new(), size: 0}}
  def handle_cast({:trace, t}, s) do
    Phoenix.PubSub.broadcast(PerplexityMacro.PubSub, "macro_vm:trace", {:vm_trace, t})
    q = :queue.in(t, s.queue)
    {q, sz} = if s.size + 1 > 50000 do {:queue.drop(q), s.size} else {q, s.size + 1} end
    {:noreply, %{s | queue: q, size: sz}}
  end
  def handle_call({:latest, n}, _from, s), do: {:reply, s.queue |> :queue.to_list() |> Enum.take(-n), s}
end
