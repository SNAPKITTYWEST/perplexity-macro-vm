defmodule PerplexityMacro.Compiler do
  def compile(source, _opts \\ []), do: {:ok, %{rom: %{}, symbols: %{}, source_map: %{}, manifest: %{source: source}}}
end
