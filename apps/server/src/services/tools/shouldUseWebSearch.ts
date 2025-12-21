const WEB_SEARCH_HINT_PATTERN =
  /今天|今日|最新|最近|现在|当前|实时|今年|本周|本月|昨天|股价|天气|新闻|资讯|发布会|多少钱|价格|汇率|today|latest|recent|now|current|news|price|weather/i;

export const shouldUseWebSearch = (prompt: string): boolean => {
  return WEB_SEARCH_HINT_PATTERN.test(prompt.trim());
};
