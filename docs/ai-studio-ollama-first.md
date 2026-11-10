# Bastilla OS — Google AI Studio (bez Cloud Run i bez Cloudflare jako backendu)

Ten projekt pozostaje aplikacją Google AI Studio z Node.js/React. Naciśnij **Preview**, aby sprawdzić UI. **Nie wybieraj Publish → Cloud Run**, jeśli konto Google Cloud nie ma aktywnego billing. Podgląd edytora nie jest dowodem, że istnieje produkcyjny host Linux.

## Silniki czatu

Ustaw w **środowisku serwera**, a nie w klienckim JavaScript:

```dotenv
LLM_PROVIDERS=ollama,gemini
OLLAMA_MODEL=llama3.2-vision:11b
OLLAMA_BASE_URL=http://127.0.0.1:11434
GEMINI_MODEL=gemini-3.1-flash-lite
CHAT_LOCAL_FALLBACK=off
```

`GEMINI_API_KEY` jest sekretem i nie może trafić do repozytorium, historii czatu ani do kodu przeglądarki.

**Uwaga:** `127.0.0.1` oznacza miejsce, w którym wykonuje się backend Node.js — nie komputer czy telefon użytkownika. Nie zakładaj, że AI Studio ma zainstalowane Ollama, pobrany model 11B lub RAM wystarczający na inferencję. Jeśli serwer Ollama nie istnieje, aplikacja powinna jawnie zgłosić brak połączenia i spróbować skonfigurowanego Gemini, a nie podawać wymyślonych odpowiedzi.

Jeśli Ollama działa na osobnym hoście, użyj uwierzytelnionego punktu pośredniczącego HTTPS; nie wystawiaj niezabezpieczonego portu Ollama 11434 do internetu. Istniejący silnik Ollama w `src/kernel/llmChain.ts` wykonuje zapytania do `/api/chat` i `/api/tags`. Samo wpisanie zdalnego URL bez zabezpieczeń nie daje bezpiecznej integracji.

## Test po synchronizacji

1. W Google AI Studio zaimportuj/zsynchronizuj aktualną gałąź `main` z repozytorium `u6930438163-code/AI_Studio_BastillaOS`.
2. Restartuj podgląd aplikacji, żeby backend dostał nowe ustawienia.
3. Otwórz `GET /api/ai/status` z poziomu **tego samego uruchomionego backendu**, sprawdź `ollama` i model. Zwracana etykieta `configured` NIE oznacza działającego modelu.
4. Wyślij realną wiadomość do czatu i sprawdź, jaki provider obsłużył odpowiedź. Bez połączenia z Ollama możliwy jest tylko działający Gemini (jeżeli jest dostępny klucz i limit API).
5. Nie oznaczaj agentów jako aktywnych bez rzeczywistych odpowiedzi workerów. Nie pokazuj danych floty, statków, maszyn VM ani telemetrii, których aplikacja nie pobrała ze źródła.

## GitHub

Źródłem kodu jest tylko `main`. GitHub nie synchronizuje automatycznie stanu pamięci RAM, uruchomionych procesów, zainstalowanych modeli czy stanu Google AI Studio Preview. Starsze pliki Cloudflare są zachowane wyłącznie jako osobny eksperyment; nie biorą udziału w ścieżce czatu AI Studio.

## Uwaga o hostingu

Google AI Studio może pozwalać na edycję i podgląd aplikacji bez Cloud Run. Nie oznacza to gotowego publicznego serwera dostępnego 24/7 ani możliwości uruchomienia ciężkiego modelu 11B w samym AI Studio.
