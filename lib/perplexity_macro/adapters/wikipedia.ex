defmodule PerplexityMacro.Adapters.Wikipedia do
  @moduledoc "Wikipedia research via MediaWiki extracts + search."
  def run(query, _opts \\ []) do
    url = "https://en.wikipedia.org/w/api.php"
    params = [action: "query", prop: "extracts", explaintext: true, titles: query, format: "json", redirects: true]
    case Req.get(url, params: params) do
      {:ok, %{status: 200, body: %{"query"=>%{"pages"=>pages}}}} ->
        results = pages |> Map.values() |> Enum.map(fn p -> %{title: p["title"], url: "https://en.wikipedia.org/wiki/#{URI.encode(p["title"])}", content: String.slice(p["extract"]||"",0,4000), score: 1.0, source_hash: :erlang.phash2(p["title"],0xFFFFFFFF)} end)
        {:ok, results}
      {:ok, %{status: s, body: b}} -> {:error, {s,b}}
      {:error, r} -> {:error, r}
    end
  end
  def search(query), do: run(query)
end
