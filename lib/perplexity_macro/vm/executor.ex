defmodule PerplexityMacro.VM.Executor do
  def execute(decoded, vm), do: {vm, [decoded.asm]}
end
