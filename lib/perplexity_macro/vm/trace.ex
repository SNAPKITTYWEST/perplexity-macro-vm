defmodule PerplexityMacro.Trace do
  @enforce_keys [:seq, :pc, :raw, :asm, :cycles_before, :cycles_after]
  defstruct [:seq, :pc, :raw, :asm, :cycles_before, :cycles_after, :registers_before, :registers_after, effects: [], memory_writes: []]
end
