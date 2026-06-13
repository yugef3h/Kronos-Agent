import re
from typing import List, Dict

# 纯规则拆分引擎
class QuerySplitRuleEngine:
    def __init__(self):
        # ========== 可配置阈值（线上放配置中心，不要硬写死） ==========
        self.short_sentence_max_len = 60      # 短句最大字符数
        self.question_mark_threshold = 2     # 问号≥2 直接判定为复合问题
        # 疑问标点
        self.question_punct = {"?", "？"}
        # 分句标点
        self.split_punct = {"?", "？", "。", "！", "!", "；", ";"}
        # 并列连接词（无标点多问题辅助判断）
        self.connect_words = ["和", "以及", "还有", "另外", "同时", "并且", "再者"]
        # 正则：分句
        self.split_pattern = re.compile(f"[{re.escape(''.join(self.split_punct))}]")

    def is_short_sentence(self, query: str) -> bool:
        """判断是否为短句"""
        return len(query.strip()) <= self.short_sentence_max_len

    def count_question_mark(self, query: str) -> int:
        """统计疑问标点数量"""
        return sum(1 for char in query if char in self.question_punct)

    def has_connect_word(self, query: str) -> bool:
        """检测是否包含并列连接词"""
        for word in self.connect_words:
            if word in query:
                return True
        return False

    def is_complex_question(self, query: str) -> Dict:
        """
        综合判断是否为【复合问题】
        返回：{is_complex: bool, reason: str}
        """
        query = query.strip()
        q_mark_num = self.count_question_mark(query)

        # 规则1：问号数量达标 → 直接判定复合问题
        if q_mark_num >= self.question_mark_threshold:
            return {"is_complex": True, "reason": "疑问标点数量大于等于2"}

        # 规则2：短句 + 单个问号 → 判定为单问题
        if self.is_short_sentence(query) and q_mark_num == 1:
            return {"is_complex": False, "reason": "短句+单个疑问标点，判定为单问题"}

        # 规则3：长句 + 包含并列连接词 → 判定复合问题
        if not self.is_short_sentence(query) and self.has_connect_word(query):
            return {"is_complex": True, "reason": "长文本+包含并列连接词"}

        # 其余情况：默认单问题
        return {"is_complex": False, "reason": "未命中复合问题规则，判定为单问题"}

    def rule_split(self, query: str) -> List[str]:
        """纯规则：按标点拆分问句，并清洗空串"""
        query = query.strip()
        if not query:
            return []
        # 按标点分割
        parts = self.split_pattern.split(query)
        # 清洗：去空格、过滤空内容
        res = [p.strip() for p in parts if p.strip()]
        return res


# ==================== 测试示例 ====================
if __name__ == "__main__":
    engine = QuerySplitRuleEngine()

    test_cases = [
        "上一届世界杯是在哪年进行的？中国足球夺冠了吗？",
        "今天天气怎么样",
        "请问早餐吃什么和午餐准备什么",
        "你是谁",
        "去北京怎么走？酒店怎么预定？门票在哪里买！",
        "世界杯哪年举办国足有没有夺冠"
    ]

    for idx, text in enumerate(test_cases, 1):
        print(f"【测试用例{idx}】原文：{text}")
        # 1. 判断是否复合问题
        check = engine.is_complex_question(text)
        print(f"是否复合问题：{check['is_complex']}，原因：{check['reason']}")
        # 2. 规则拆分结果
        split_res = engine.rule_split(text)
        print(f"规则拆分结果：{split_res}\n")



# 和 LLM 混合架构对接示例
def pipeline_query_process(query: str):
    engine = QuerySplitRuleEngine()
    # 第一步：本地规则判断（毫秒级）
    check_res = engine.is_complex_question(query)

    if not check_res["is_complex"]:
        # 单问题：直接走检索/问答，不拆分
        return [query.strip()]

    # 判定为复合问题：尝试调用 LLM 精拆
    try:
        # llm_split_res = call_llm_split_api(query)  # 你自己的LLM调用函数
        # return llm_split_res
        pass
    except Exception:
        # LLM 超时/报错：自动降级为规则拆分
        return engine.rule_split(query)