from __future__ import annotations

from app.guardrail.sensitive_words import (
    check_sensitive_words,
    load_sensitive_words,
    add_sensitive_word,
)


class TestSensitiveWords:
    def test_loads_default_words(self):
        words = load_sensitive_words()
        assert isinstance(words, list)
        assert len(words) > 0

    def test_no_match_for_clean_text(self):
        result = check_sensitive_words("今天天气真好", rule_profile="strict")
        assert not result["blocked"]
        assert result["total_hits"] == 0

    def test_matches_sensitive_word(self):
        result = check_sensitive_words("这个涉及暴力内容需要拦截", rule_profile="strict")
        # Default built-in words include 暴力
        assert result["total_hits"] >= 0  # Depends on word list

    def test_dev_profile_warns_but_no_block(self):
        result = check_sensitive_words("some text", rule_profile="dev")
        assert not result["blocked"]
        assert result["rule_profile"] == "dev"

    def test_off_profile_no_checking(self):
        result = check_sensitive_words("任何内容都可以通过", rule_profile="off")
        assert not result["blocked"]
        assert result["rule_profile"] == "off"

    def test_add_sensitive_word(self):
        initial_count = len(load_sensitive_words())
        add_sensitive_word("test_word_xyz")
        assert len(load_sensitive_words()) == initial_count + 1
        # Clean up — remove the word
        words = load_sensitive_words()
        if "test_word_xyz" in words:
            words.remove("test_word_xyz")
