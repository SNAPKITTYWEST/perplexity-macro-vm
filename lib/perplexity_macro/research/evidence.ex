defmodule PerplexityMacro.Evidence do
  def normalize({:ok, results}), do: results
  def normalize(results) when is_list(results), do: results
  def encode_tlv(results), do: :erlang.term_to_binary(results)
end
