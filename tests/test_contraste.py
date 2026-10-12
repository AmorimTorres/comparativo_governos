import importlib.util
from pathlib import Path

spec = importlib.util.spec_from_file_location("contraste", Path(__file__).resolve().parent.parent / "scripts" / "contraste.py")
contraste = importlib.util.module_from_spec(spec)
spec.loader.exec_module(contraste)


def test_pares_de_cores_passam_wcag():
    assert contraste.verificar() == []
