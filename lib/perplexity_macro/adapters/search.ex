defmodule PerplexityMacro.Adapters.Search do
  @moduledoc "Tavily deep-research via TLV-compatible output."
  def run(query, opts \\ []) do
    api_key = Keyword.get(opts, :api_key) || System.fetch_env!("TAVILY_API_KEY")
    payload = %{"query"=>query,"search_depth"=>"advanced","include_answer"=>true,"max_results"=>5}
    case Req.post("https://api.tavily.com/search", json: payload, headers: [{"authorization","Bearer #{api_key}"}]) do
      {:ok, %{status: 200, body: body}} -> {:ok, normalize(body)}
      {:error, r} -> {:error, r}
    end
  end
  defp normalize(body), do: Enum.map(body["results"]||[], fn i -> %{title: i["title"], url: i["url"], content: i["content"], score: i["score"], source_hash: :erlang.phash2(i["url"],0xFFFFFFFF)} end)
end
