import pytest
from cryptography.fernet import Fernet, InvalidToken

from app.core import crypto
from app.core.crypto import decrypt_value, encrypt_value


def _key() -> str:
    return Fernet.generate_key().decode()


def _reset(keys: list[str]) -> None:
    crypto._set_keys(keys)


class TestRoundTrip:
    def test_returns_plaintext_after_encrypt_then_decrypt(self):
        _reset([_key()])
        plain = "cliente@example.com"
        cipher = encrypt_value(plain)
        assert cipher != plain
        assert decrypt_value(cipher) == plain

    def test_unicode_round_trips_losslessly(self):
        _reset([_key()])
        plain = "José García — Cañada 123, ñoño"
        assert decrypt_value(encrypt_value(plain)) == plain

    def test_500_char_address_round_trips_losslessly(self):
        _reset([_key()])
        plain = "Calle Falsa 123, Piso 4, Depto B, " * 8
        assert decrypt_value(encrypt_value(plain)) == plain


class TestNonePassthrough:
    def test_encrypt_none_returns_none(self):
        _reset([_key()])
        assert encrypt_value(None) is None

    def test_decrypt_none_returns_none(self):
        _reset([_key()])
        assert decrypt_value(None) is None


class TestEmptyString:
    def test_empty_string_round_trips(self):
        _reset([_key()])
        assert decrypt_value(encrypt_value("")) == ""


class TestFernetIsNondeterministic:
    def test_two_encryptions_of_same_input_produce_different_ciphertext(self):
        _reset([_key()])
        a = encrypt_value("same")
        b = encrypt_value("same")
        assert a != b
        assert decrypt_value(a) == "same"
        assert decrypt_value(b) == "same"


class TestMultiFernetRotation:
    def test_old_ciphertext_decrypts_after_new_key_becomes_primary(self):
        key_old = _key()
        key_new = _key()

        _reset([key_old])
        cipher = encrypt_value("legacy-data")

        _reset([key_new, key_old])
        assert decrypt_value(cipher) == "legacy-data"

    def test_new_ciphertext_does_not_decrypt_with_only_old_key(self):
        key_old = _key()
        key_new = _key()

        _reset([key_old])
        encrypt_value("ignored")

        _reset([key_new, key_old])
        cipher_new = encrypt_value("with-new-key")

        _reset([key_old])
        with pytest.raises(InvalidToken):
            decrypt_value(cipher_new)


class TestMissingKeysFailLoud:
    def test_encrypt_without_keys_raises_runtime_error(self):
        _reset([])
        with pytest.raises(RuntimeError, match="keyset"):
            encrypt_value("boom")

    def test_decrypt_without_keys_raises_runtime_error(self):
        _reset([])
        with pytest.raises(RuntimeError, match="keyset"):
            decrypt_value("gAAAAAblob")


class TestFernetPrefixUsedByMigration:
    def test_encrypted_tokens_start_with_gAAAAA(self):
        _reset([_key()])
        cipher = encrypt_value("hi")
        assert cipher.startswith("gAAAAA")
