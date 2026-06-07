from __future__ import annotations

from app.guardrail.pii_detector import detect_pii, mask_pii


class TestPIIDetection:
    def test_detects_chinese_mobile(self):
        result = detect_pii("我的手机号是13812345678请联系我")
        assert result.has_pii
        assert any(h.type == "phone" for h in result.hits)

    def test_detects_chinese_id_card(self):
        result = detect_pii("身份证号110101199001011234请核实")
        assert result.has_pii
        assert any(h.type == "id_card" for h in result.hits)

    def test_detects_email(self):
        result = detect_pii("contact me at test@example.com for details")
        assert result.has_pii
        assert any(h.type == "email" for h in result.hits)

    def test_clean_text_has_no_pii(self):
        result = detect_pii("今天天气很好，适合出去玩")
        assert not result.has_pii

    def test_empty_text(self):
        result = detect_pii("")
        assert not result.has_pii

    def test_disabled_checks(self):
        result = detect_pii(
            "phone 13812345678 email test@mail.com",
            check_phone=False,
            check_email=False,
        )
        assert not result.has_pii

    def test_summary_counts(self):
        result = detect_pii("电话13811111111和13922222222都可以联系")
        assert result.summary["phone_count"] >= 2
        assert result.summary["total_hits"] >= 2

    def test_mask_pii_redacts_content(self):
        masked = mask_pii("我的邮箱是admin@example.com欢迎联系")
        assert "@" not in masked or "admin" not in masked.lower()
