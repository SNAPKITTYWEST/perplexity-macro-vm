defmodule PerplexityMacro.Capability do
  @search 0x01
  @fetch 0x02
  @browser 0x03
  @code 0x04
  @local_model 0x05
  @wikipedia 0x06
  @mathematica 0x07
  @dictionary 0x08
  def sensitive?(cap), do: cap in [@browser, @code, @wikipedia, @mathematica]
end
