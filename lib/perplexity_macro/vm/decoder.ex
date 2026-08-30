defmodule PerplexityMacro.VM.Decoder do
  def decode(raw, _vm), do: %{raw: raw, cycles: 1, asm: "NOP"}
  def format(d), do: d.asm
end
