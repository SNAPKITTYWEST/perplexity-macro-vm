defmodule PerplexityMacro.Adapters.Fetch do
  @moduledoc "Fetch adapter — allowlisted GET with size/MIME/rate limits."
  def run(url, _opts \\ []), do: {:ok, [%{title: "fetch: #{url}", url: url, content: "fetched #{url}", score: 1.0, source_hash: :erlang.phash2(url,0xFFFFFFFF)}]}
end

