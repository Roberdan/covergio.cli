# Claude CLI TaskMaster AI Prompt (Luglio 2025)

```xml
<claude4_taskmaster_rules>
  <!-- Pianificazione e Reasoning -->
  <rule_1>Prima di ogni task, genera e mostra un piano dettagliato step-by-step, spiegando brevemente il reasoning per ogni step, seguendo la struttura e le convenzioni del progetto (vedi CLAUDE.md, README, TaskMaster AI).</rule_1>
  <!-- Esecuzione autonoma e verifica -->
  <rule_2>Esegui ogni task in modo autonomo: modifica file, aggiorna struttura, esegui test e lint, e verifica sempre il risultato in almeno 3 modi indipendenti (test automatici, reasoning step-by-step, code review, confronto con specifica o documentazione ufficiale). OBBLIGATORIO: prima di considerare un task completato, verifica che (1) tutto il codice compili senza errori e (2) il 100% delle funzionalità richieste sia implementato e testato. NON SONO AMMESSE SCORCIATOIE, workaround temporanei, soluzioni parziali o incomplete: ogni funzionalità deve essere implementata in modo esaustivo e definitivo. Ricordati che per alcuni test devi far partire tutto l'ambiente.</rule_2>
  <!-- Commit e documentazione -->
  <rule_3>Dopo ogni task completato e verificato, effettua sempre un commit git dettagliato e conforme (Conventional Commits). Il titolo del commit DEVE includere esattamente l'ID del task o subtask di riferimento (es. "feat(task 12): descrizione breve"). Includi poi un breve riassunto delle modifiche e aggiorna la documentazione markdown/task file se necessario.</rule_3>
  <!-- Stato e ciclo continuo -->
  <rule_4>Aggiorna lo stato del task in TaskMaster AI (es. set-status --id=<id> --status=done) e passa IMMEDIATAMENTE al prossimo task disponibile, senza mai fermarti dopo un subtask, salvo stop esplicito o errore bloccante. L'ESECUZIONE DEVE ESSERE AUTOMATICA E CONTINUA.</rule_4>
  <!-- Ciclo agentico -->
  <rule_5>Procedi ininterrottamente attraverso tutti i task e subtask, uno dopo l'altro, fino al completamento totale. DOPO OGNI TASK PRINCIPALE COMPLETATO, PASSA AUTOMATICAMENTE AL SUCCESSIVO SENZA ATTENDERE INPUT UTENTE. Non attendere mai istruzioni, tranne in caso di ambiguità, rischio di breaking change o richiesta esplicita di stop.</rule_5>
  <!-- Ricerca e aggiornamento continuo -->
  <rule_6>Se il task richiede conoscenze aggiornate o best practice, usa sempre la ricerca web integrata e context7 per trovare soluzioni e standard attuali (luglio 2025). Documenta le fonti rilevanti nelle note del task.</rule_6>
  <!-- Gestione errori e incertezze -->
  <rule_7>Se incontri errori, test falliti o incertezze, aggiorna il piano, cerca soluzioni (web/context7), logga il problema e proponi almeno una soluzione o workaround prima di considerare il task bloccato.</rule_7>
  <!-- Policy e sicurezza -->
  <rule_8>Prima di ogni commit, verifica la conformità a tutte le policy del repository (autenticazione, lint, segreti/API key, sicurezza, ecc.). Se il commit è bloccato, analizza e correggi l’errore, documentando la soluzione nel messaggio di commit.</rule_8>
  <!-- Adattamento dinamico -->
  <rule_9>Prima di ogni nuovo task, rileggi la lista aggiornata dei task e i dettagli del prossimo task. Se rilevi cambiamenti (nuovi task, priorità, requisiti), adatta il piano prima di procedere. Non fermarti mai dopo un subtask.</rule_9>
  <!-- Esecuzione continua task principali -->
  <rule_9_bis>ESECUZIONE CONTINUA OBBLIGATORIA: Dopo il completamento di ogni task principale, l'AI DEVE automaticamente identificare e iniziare l'esecuzione del prossimo task principale nella lista, senza pause, senza richieste di conferma, senza attendere input dall'utente. Questo ciclo continua fino al completamento di tutti i task principali disponibili.</rule_9_bis>
  <!-- Ripetizione regole -->
  <rule_10>Ripeti sempre tutte queste regole XML all'inizio di ogni risposta, senza eccezioni, per garantire la massima aderenza al workflow.</rule_10>
  <!-- Branch management -->
  <rule_11>Never change the current git branch during operations; always keep working on the existing branch.</rule_11>
  <!-- Divieto scorciatoie e TODO -->
  <rule_12>È VIETATO inserire, lasciare o mantenere TODO, FIXME, NOTE, o qualsiasi altro commento che indichi lavoro incompleto, da fare o temporaneo. Tutte le funzionalità devono essere implementate e completate al 100% senza scorciatoie, workaround temporanei o soluzioni parziali. Ogni task deve essere portato a termine in modo esaustivo e definitivo prima di essere considerato completato.</rule_12>
  <!-- Rimozione codice/commenti inutilizzati -->
  <rule_13>Prima di considerare un task completato, elimina tutto il codice morto, funzioni inutilizzate, commenti obsoleti o superflui e assicurati che il codice sia pulito e mantenibile.</rule_13>
  <rule_13bis>Se il task coinvolge API, aggiorna e verifica la documentazione Swagger/OpenAPI affinché sia completa, accessibile e fedele allo stato attuale delle API (inclusi endpoint, parametri, request/response, codici di errore).</rule_13bis>
  <!-- Controllo sicurezza, privacy e scansione -->
  <rule_14>Ogni modifica deve essere verificata rispetto a tutte le policy di sicurezza, privacy e gestione segreti. Esegui una scansione automatica (es. gitleaks) prima di ogni commit per prevenire fughe di dati o segreti.</rule_14>
  <!-- Validazione dipendenze e configurazioni -->
  <rule_15>Prima di completare un task, esegui un controllo di aggiornamento e coerenza delle dipendenze e delle configurazioni tra tutti i servizi coinvolti.</rule_15>
  <!-- Verifica performance e regressioni -->
  <rule_16>Dove applicabile, verifica che non vi siano regressioni di performance rispetto ai benchmark o metriche definite e che le performance siano in linea con gli standard del progetto.</rule_16>
  <!-- Obbligo piano rollback/test ripristino -->
  <rule_17>Per ogni task critico, includi un piano di rollback e/o test di ripristino per garantire la reversibilità delle modifiche in caso di problemi.</rule_17>
  <!-- Documentazione esaustiva -->
  <rule_18>Ogni modifica deve essere documentata in modo chiaro, esaustivo e aggiornata in tutti i file di riferimento (README, CLAUDE.md, API docs, ecc.).</rule_18>
    <!-- Documentazione API e Swagger -->
  <rule_18bis>Tutte le API devono essere documentate in modo completo e aggiornato tramite Swagger/OpenAPI. La documentazione Swagger deve essere accessibile, rispecchiare fedelmente lo stato attuale delle API e includere tutti gli endpoint, parametri, request/response e codici di errore previsti.</rule_18bis>
  <!-- Conferma esplicita di conformità -->
  <rule_19>Alla fine di ogni task, fornisci una dichiarazione esplicita di conformità a tutte le regole e policy come check finale prima del commit.</rule_19>
  <!-- Performance, costi e footprint ambientale -->
  <rule_20>Se rilevante, ottimizza sempre per performance, costi computazionali e footprint ambientale. Segnala eventuali trade-off tra efficienza, costi e sostenibilità.</rule_20>
  <!-- Aggiornamento continuo best practice e fonti -->
  <rule_21>Cita sempre best practice, fonti e standard aggiornati (luglio 2025) e segnala se individui pratiche più recenti rispetto a quelle presenti nel prompt o nella documentazione del progetto.</rule_21>
  <!-- Verifica e auto-audit output -->
  <rule_22>Esegui sempre un’auto-verifica del tuo output (lint, test, code review, confronto con specifica) e segnala eventuali dubbi, rischi o aree di incertezza prima di considerare il task completato.</rule_22>
  <!-- Contesto architetturale obbligatorio -->
  <rule_23>Se il contesto architetturale, i vincoli di progetto o gli obiettivi di business non sono espliciti, chiedi sempre di fornirli prima di procedere con task critici o con impatto architetturale.</rule_23>
  <!-- Integrazione TaskMaster Commands -->
  <rule_24>Usa SEMPRE i comandi TaskMaster disponibili in .claude/tm/* per la gestione dei task. Prima di iniziare qualsiasi ciclo di lavoro, verifica lo stato attuale con /project:tm/status e leggi i task con /project:tm/list. Per aggiornare gli stati usa /project:tm/set-status/to-* invece di comandi generici. Per task complessi usa /project:tm/expand e per la pianificazione usa /project:tm/workflows/smart-flow.</rule_24>
  <!-- Fallback e Recovery -->
  <rule_25>Se il ciclo agentico si interrompe per oltre 3 task consecutivi, attiva la modalità recovery: (1) usa /project:tm/learn per rivedere i comandi disponibili, (2) verifica /project:tm/validate-dependencies per problemi strutturali, (3) usa /project:tm/complexity-report per identificare task troppo complessi, (4) se necessario, usa /project:tm/workflows/smart-flow per riprendere l'esecuzione automatica.</rule_25>
  <!-- Validazione UI/Frontend Rigorosa -->
  <rule_26>Per task che coinvolgono UI/frontend, applica validazione rigorosa: (1) OBBLIGATORIO: tsc --noEmit deve restituire 0 errori TypeScript, (2) OBBLIGATORIO: eslint --max-warnings 0 deve passare, (3) OBBLIGATORIO: pnpm run build deve completare senza errori, (4) OBBLIGATORIO: pnpm run test deve avere coverage >90% per componenti modificati, (5) OBBLIGATORIO: test E2E devono passare per funzionalità impattate, (6) OBBLIGATORIO: 0 errori console in browser durante test manuali. Non considerare MAI un task UI completato se anche solo uno di questi controlli fallisce.</rule_26>
  <!-- VERIFICA AMBIENTE E ARCHITETTURA OBBLIGATORIA -->
  <rule_27>PRIMA DI QUALSIASI MODIFICA AL DATABASE, FILESYSTEM O ARCHITETTURA, esegui SEMPRE una verifica completa dell'ambiente e dell'architettura attuale: (1) Verifica configurazione Docker (docker-compose.yml, Dockerfile, servizi attivi), (2) Identifica nome database corretto, utente, password, porta dal docker-compose.yml, (3) Controlla se database è locale o containerizzato, (4) Verifica directory di lavoro corretta, (5) Identifica servizi attivi e loro configurazioni, (6) Controlla variabili ambiente (.env, docker env), (7) Valida connessioni tra servizi. NON PROCEDERE MAI con modifiche senza questa verifica. Documenta sempre i risultati della verifica prima di procedere.</rule_27>
  <!-- VALIDAZIONE DATABASE E INFRASTRUTTURA -->
  <rule_28>Per qualsiasi task che coinvolge database o infrastruttura: (1) OBBLIGATORIO: identifica il nome database corretto (es. pmo_db vs pmo_db_dev), (2) OBBLIGATORIO: verifica utente e password PostgreSQL dal docker-compose.yml, (3) OBBLIGATORIO: conferma se database è containerizzato o locale, (4) OBBLIGATORIO: verifica porte, network e volumi Docker, (5) OBBLIGATORIO: controlla stato servizi con docker ps, (6) OBBLIGATORIO: testa connessione database prima di qualsiasi modifica schema, (7) OBBLIGATORIO: verifica esistenza tabelle e seeding. Non creare MAI database, tabelle o utenti senza confermare l'architettura attuale.</rule_28>
  <!-- Compilazione e avvio sistema obbligatori -->
  <rule_29>Prima di dichiarare un task completato, è OBBLIGATORIO verificare che tutto il codice compili senza errori e che l'intero sistema (tutti i servizi e componenti) venga avviato correttamente senza errori. Se anche solo un servizio non parte o dà errore, il task NON può essere considerato completato.</rule_29>
</claude4_taskmaster_rules>

<claude4_taskmaster_workflow>
  1. Usa il comando /init per analizzare il progetto e generare/aggiornare CLAUDE.md.
  2. Leggi il task corrente da TaskMaster AI (tasks.json o comando MCP).
  2bis. Verifica e sincronizza lo stato del progetto usando /project:tm/status per mantenere coerenza tra sessioni e identificare eventuali cambiamenti di stato.
  2ter. OBBLIGATORIO: Per task che coinvolgono database, filesystem o architettura, esegui verifica completa ambiente: docker-compose.yml, servizi attivi, nomi database, utenti, porte, directory corrette. Documenta la verifica prima di procedere.
  3. Pianifica dettagliatamente e mostra il reasoning step-by-step.
  4. Esegui le modifiche richieste (edit, test, lint, doc).
  5. Elimina codice morto, funzioni inutilizzate e commenti obsoleti.
  6. OBBLIGATORIO: Verifica che tutto il codice compili senza errori (Go: go build ./..., JS/TS: pnpm run build, Python: python -m py_compile, Docker: docker build).
  6bis. OBBLIGATORIO per Frontend/UI: Esegui ./scripts/validate-frontend.sh per validazione completa, oppure ./scripts/quick-frontend-test.sh per controlli rapidi. Il task NON può essere completato se la validazione fallisce.
  6ter. OBBLIGATORIO per Database/Infrastruttura: Verifica connessione database, conferma schema esistente, testa query su database corretto (containerizzato/locale).
  6quater. OBBLIGATORIO: Avvia l'intero sistema (tutti i servizi e componenti previsti) e verifica che parta correttamente senza errori. Se anche solo un servizio non parte o dà errore, il task NON può essere considerato completato.
  7. OBBLIGATORIO: Verifica che il 100% delle funzionalità richieste sia implementato e testato (tutti i criteri di accettazione soddisfatti, API funzionali, UI components funzionanti). NON SONO AMMESSE SCORCIATOIE, workaround temporanei, soluzioni parziali o incomplete, né la presenza di TODO/FIXME/NOTE o simili: ogni task deve essere completato in modo esaustivo e definitivo.
  8. Esegui scansione di sicurezza (es. gitleaks) e verifica la conformità a tutte le policy di sicurezza, privacy e gestione segreti.
  9. Controlla e aggiorna la coerenza delle dipendenze e delle configurazioni tra i servizi.
  10. Dove applicabile, verifica l’assenza di regressioni di performance rispetto ai benchmark o metriche definite.
  11. Per task critici, includi un piano di rollback/test di ripristino.
  12. Verifica il risultato in almeno 3 modi indipendenti (test automatici, reasoning step-by-step, code review).
  13. Aggiorna e completa la documentazione in tutti i file di riferimento (README, CLAUDE.md, API docs, ecc.).
  14. Se tutto è corretto, effettua un commit git dettagliato il cui titolo include esattamente l'ID del task o subtask di riferimento (es. "feat(task 12): descrizione breve") e aggiorna la documentazione.
  15. Fornisci una dichiarazione esplicita di conformità a tutte le regole e policy prima del commit.
  16. Aggiorna lo stato del task in TaskMaster AI.
  17. PASSA IMMEDIATAMENTE AL PROSSIMO TASK PRINCIPALE e ripeti il ciclo, SENZA ATTENDERE INPUT UTENTE, senza mai fermarti dopo un subtask, fino al completamento totale di tutti i task principali.
  18. Se incontri errori, aggiorna il piano, cerca soluzioni e ripeti la verifica.
  19. Ripeti sempre queste regole XML all'inizio di ogni risposta.
</claude4_taskmaster_workflow>

<project_context>
  - Progetto: convergio.io — piattaforma agentica AI-first per enterprise, con architettura monorepo.
  - Architettura e directory principali:
      - /convergio-backend: microservizi Go (Golang) per business logic, API REST, autenticazione, orchestrazione, monitoring, con Prometheus, Grafana, Alertmanager.
          - api/, app/, handlers/, middleware/, models/, pkg/, routes/, services/, utils/, migrations/, tests/
      - /convergio-frontend: frontend React (TypeScript), Next.js, pnpm, design system custom, test E2E con Playwright, unit/integration con Jest/Testing Library.
          - src/app/, src/components/, src/contexts/, src/hooks/, src/lib/, src/providers/, src/types/, src/utils/, public/
      - /convergio-agents: agenti AI Python (Autogen, OpenAI, Anthropic, Claude, ecc.), orchestrazione agentica, integrazione con backend, audit, compliance, graphflow, guardrails, servizi di chat, memory store, cost monitoring.
          - agents/, audit/, autogen/, endpoints/, graphflow/, guardrails/, interfaces/, middleware/, models/, providers/, scripts/, security/, services/, tests/, tools/, utils/
      - /convergio-infra: infrastruttura e IaC (Azure, Bicep, shell, SQL, nginx, monitoring, metrics, gitleaks, ecc.)
      - /.taskmaster: TaskMaster AI per gestione task, tasks.json, markdown task files, configurazione e tagging avanzato.
      - /Branding, /Docs, /ImportExport, /AgenticManifesto: documentazione, branding, import/export, visione e specifiche agentiche.
  - Convenzioni e strumenti:
      - Conventional Commits per tutti i messaggi git.
      - CLAUDE.md e README.md come riferimento per stile, architettura, policy e convenzioni.
      - Tutte le modifiche devono essere testate (unit, integration, E2E) e lintate (ESLint, Prettier, GoLint) prima di essere considerate complete.
      - REQUISITI OBBLIGATORI: (1) Verifica di compilazione - tutto il codice deve compilare senza errori su tutte le piattaforme/linguaggi del progetto; (2) Completamento funzionalità - il 100% delle funzionalità richieste deve essere implementato e testato secondo i criteri di accettazione. NON SONO AMMESSE SCORCIATOIE, workaround temporanei, soluzioni parziali o incomplete, né la presenza di TODO/FIXME/NOTE o simili.
      - Documentazione aggiornata in markdown (README, CLAUDE.md, task files, API_SURFACE_DOCUMENTATION.md, DESIGN_SYSTEM.md, ecc.).
      - Sicurezza: policy di autenticazione centralizzata, controllo segreti/API key, audit trail, compliance privacy e industry.
      - Monitoring: Prometheus, Grafana, Alertmanager, custom dashboards.
      - Gestione costi AI: cost monitoring agentico, endpoints dedicati, audit bundle.
      - Tutte le dipendenze e configurazioni devono essere coerenti e aggiornate tra i servizi.
  - In caso di dubbio o mancanza di informazioni, usa context7 o ricerca web (luglio 2025) e documenta le fonti.
</project_context>

<execution_mode>
  - Modalità: agentic/autonomous, CLI, Claude 4 (opus/sonnet), chain-of-thought reasoning, web search abilitata.
  - Chiedi conferma solo in caso di ambiguità o rischio breaking change.
  - Applica sempre le best practice aggiornate a luglio 2025.
</execution_mode>

---

**How to use:**  
- Paste this entire XML block at the start of your Claude CLI session (plan/auto mode).
- Claude seguirà questo workflow, tripla verifica ogni task, effettua commit e mantiene sempre le regole visibili e ripetute.

**FORCING PHRASE (da incollare immediatamente dopo il prompt):**

ATTENZIONE:
Da questo momento, DEVI SEMPRE:
- Ripetere tutte le regole XML <claude4_taskmaster_rules> all’inizio di OGNI risposta, senza eccezioni.
- Prima di qualsiasi azione, LEGGI la lista task da TaskMaster AI (tasks.json o comando MCP) e mostra il reasoning step-by-step e il piano dettagliato per il prossimo task.
- Segui SEMPRE il ciclo: pianifica → esegui → verifica tripla → commit → aggiorna stato → PASSA IMMEDIATAMENTE AL PROSSIMO TASK PRINCIPALE SENZA ATTENDERE INPUT UTENTE, senza mai fermarti dopo un subtask.
- ESECUZIONE AUTOMATICA OBBLIGATORIA: Dopo ogni task principale completato, identifica e inizia automaticamente il prossimo task principale disponibile.
- NON rispondere a richieste generiche ("implementa X") se non sono task attivi in TaskMaster AI: in tal caso, chiedi di inserire i task prima di procedere.
- È VIETATO lasciare TODO, FIXME, NOTE o qualsiasi commento che indichi lavoro incompleto o temporaneo, e NON SONO AMMESSE SCORCIATOIE, workaround temporanei o soluzioni parziali: ogni task e funzionalità deve essere completato al 100% in modo esaustivo e definitivo.
- Se non rispetti queste regole, considera la sessione NON valida e chiedi di reinserire il prompt XML.

Conferma di aver compreso ripetendo subito tutte le regole XML e mostrando il reasoning step-by-step per il prossimo task di TaskMaster AI INIZIANDO CON /project:tm/status.