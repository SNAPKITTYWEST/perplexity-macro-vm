defmodule PerplexityMacro.ToolRouter do
  @moduledoc "Capability Router — VM owns control, host owns evidence. Sensitive caps require CONFIRM 0x2A."
  use GenServer
  @confirm_ttl_ms 60_000
  def start_link(opts), do: GenServer.start_link(__MODULE__, opts, name: __MODULE__)
  @impl true
  def init(_opts), do: {:ok, %{confirm: nil}}

  @doc "Route RQ → either WASM Box (python) or ResearchBroker (external). Policy: sensitive needs CONFIRM."
  def route(req), do: GenServer.call(__MODULE__, {:route, req})
  def confirm, do: GenServer.call(__MODULE__, :confirm)

  @impl true
  def handle_call({:route, %{capability: cap, python: true}=req}, _from, state) do
    if PerplexityMacro.Capability.sensitive?(cap) and not valid_confirm?(state.confirm) do
      {:reply, {:error, :confirm_required}, state}
    else
      # WASM Box is isolated — no direct net/fs, tools mediated via recursive route
      result = PerplexityMacro.WASMBox.execute(req.code, req.args)
      tlv = PerplexityMacro.Evidence.encode_tlv(result)
      {:reply, {:ok, tlv}, maybe_consume_confirm(state, cap)}
    end
  end
  def handle_call({:route, %{capability: cap}=req}, _from, state) do
    if PerplexityMacro.Capability.sensitive?(cap) and not valid_confirm?(state.confirm) do
      {:reply, {:error, :confirm_required}, state}
    else
      result = dispatch_external(req)
      tlv = PerplexityMacro.Evidence.encode_tlv(result)
      {:reply, {:ok, tlv}, maybe_consume_confirm(state, cap)}
    end
  end
  def handle_call(:confirm, _from, state) do
    tok = %{token: :crypto.strong_rand_bytes(4) |> Base.encode16(), exp: System.monotonic_time(:millisecond) + @confirm_ttl_ms}
    {:reply, {:ok, tok}, %{state | confirm: tok}}
  end

  defp valid_confirm?(nil), do: false
  defp valid_confirm?(%{exp: exp}), do: System.monotonic_time(:millisecond) < exp
  defp maybe_consume_confirm(state, cap) do
    if PerplexityMacro.Capability.sensitive?(cap), do: %{state | confirm: nil}, else: state
  end
  defp dispatch_external(%{capability: :search}=r), do: PerplexityMacro.Adapters.Search.run(r.query)
  defp dispatch_external(%{capability: :wikipedia}=r), do: PerplexityMacro.Adapters.Wikipedia.run(r.query)
  defp dispatch_external(%{capability: :mathematica}=r), do: PerplexityMacro.Adapters.Mathematica.run(r.query)
  defp dispatch_external(%{capability: :dictionary}=r), do: PerplexityMacro.Adapters.Dictionary.run(r.query)
  defp dispatch_external(%{capability: :fetch}=r), do: PerplexityMacro.Adapters.Fetch.run(r.query)
  defp dispatch_external(%{capability: :browser}=r), do: PerplexityMacro.Adapters.Browser.run(r.query)
  defp dispatch_external(%{capability: :code}=r), do: PerplexityMacro.Adapters.Code.run(r.query)
  defp dispatch_external(%{capability: :local_model}=r), do: PerplexityMacro.Adapters.LocalModel.run(r.query)
  defp dispatch_external(r), do: {:ok, [%{title: "#{r.capability}", url: "#{r.capability}://", content: inspect(r), score: 1.0, source_hash: :erlang.phash2(r, 0xFFFFFFFF)}]}
end
