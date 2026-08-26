# Admitere Sibiu — MVP Supabase

Acest proiect este un frontend static conectat la proiectul Supabase `admitere-sibiu`.

## Ce include

- Email/password signup + login
- confirmare email prin Supabase Auth
- citire grile din `questions`
- răspunsuri salvate în `answers`
- dashboard cu progres
- lista „Greșelile mele”
- profil creat automat prin trigger

## 1. Configurarea întrebărilor pentru test

Cele 20 de întrebări existente sunt `draft`, iar RLS permite momentan citirea doar a celor `published`.

Pentru testarea MVP-ului cu cele 20 de întrebări, în SQL Editor rulează:

```sql
create policy "authenticated can read draft questions for mvp"
on public.questions
for select
to authenticated
using (review_status in ('draft','published'));
```

Această politică este potrivită pentru MVP/testare. Înainte de lansare publică, recomandăm să păstrăm doar întrebările verificate/publicate.

## 2. Configurația Supabase

`config.js` conține URL-ul proiectului și publishable key. Publishable key este destinată frontend-ului; nu pune niciodată în acest proiect o cheie `service_role` sau `sb_secret_...`.

## 3. Rulare locală

Nu deschide `index.html` direct prin `file://`, deoarece unele browsere limitează modulele/rețelele.

Poți folosi un server local simplu:

```bash
python3 -m http.server 5500
```

Apoi deschizi:

http://localhost:5500

sau îl publici pe un hosting static.

## 4. Confirmarea emailului

În Supabase ai activat `Confirm email`. După înregistrare, utilizatorul trebuie să verifice emailul înainte să se poată autentifica.

Pentru testare locală, configurează URL-ul aplicației în Supabase:
Authentication → URL Configuration.

## 5. Următorii pași pentru producție

- verificarea editorială a tuturor grilelor
- import masiv de întrebări
- simulare cu cronometru
- plan Free/Premium
- plăți
- admin panel pentru grile
- analytics
- domeniu propriu
