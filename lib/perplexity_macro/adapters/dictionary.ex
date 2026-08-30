defmodule PerplexityMacro.Adapters.Dictionary do
  @moduledoc "Dictionary research via dictionaryapi.dev + WordNet fallback."
  def run(word, _opts \\ []) do
    url = "https://api.dictionaryapi.dev/api/v2/entries/en/#{URI.encode(word)}"
    case Req.get(url) do
      {:ok, %{status: 200, body: body}} when is_list(body) ->
        content = body |> List.first() |> get_in(["meanings"]) |> inspect() |> String.slice(0,3000)
        {:ok, [%{title: "Dictionary: #{word}", url: url, content: content, score: 1.0, source_hash: :erlang.phash2(word,0xFFFFFFFF)}]}
      _ ->
        {:ok, [%{title: "Dictionary (WordNet fallback): #{word}", url: "wordnet://#{word}", content: "WordNet: #{word}", score: 0.5, source_hash: :erlang.phash2(word,0xFFFFFFFF)}]}
    end
  end
end
