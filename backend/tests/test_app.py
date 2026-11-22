from backend import app as app_module


def test_frontend_and_health_routes(monkeypatch, tmp_path):
    assets = tmp_path / "assets"
    assets.mkdir()
    (tmp_path / "index.html").write_text("<main>WPT EV Lab</main>", encoding="utf-8")
    (assets / "app.js").write_text("window.ready = true;", encoding="utf-8")
    monkeypatch.setattr(app_module, "FRONTEND_DIST", str(tmp_path))

    client = app_module.app.test_client()

    assert client.get("/").status_code == 200
    assert b"WPT EV Lab" in client.get("/").data
    assert client.get("/assets/app.js").data == b"window.ready = true;"
    assert client.get("/client-route").status_code == 200
    assert client.get("/api/health").json == {"status": "ok"}
    assert client.get("/api/unknown").status_code == 404
