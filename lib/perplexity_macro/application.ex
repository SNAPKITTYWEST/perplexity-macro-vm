defmodule PerplexityMacro.Application do
  use Application
  @impl true
  def start(_type, _args) do
    children = [{PerplexityMacro.ROM, [emulator_pid: nil]}, {PerplexityMacro.Host, []}]
    opts = [strategy: :one_for_one, name: PerplexityMacro.Supervisor]
    Supervisor.start_link(children, opts)
  end
end
