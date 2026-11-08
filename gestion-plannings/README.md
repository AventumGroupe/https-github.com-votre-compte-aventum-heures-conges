# Gestion des plannings

Application web installable sur Android (PWA) pour planifier ses tâches selon trois critères :

| Critère | Échelle |
|---|---|
| **Urgence** | 1 (pas du tout) à 5 (très) |
| **Importance** | 1 (pas du tout) à 5 (très) |
| **Énergie demandée** | 1 plombant · 2 fatigant · 3 stimulant · 4 dynamisant |

Il n'y a qu'un seul code pour le téléphone et l'ordinateur. L'application fonctionne hors connexion et ne demande aucun serveur.

## Les écrans

### Tâches (écran principal)
- Saisie rapide d'une tâche avec ses trois critères. Le bouton « Plus de détails… » ouvre la fiche complète.
- Score de priorité : `importance × 2 + urgence` (de 3 à 15). On peut basculer vers la **matrice urgence / importance** : Faire, Planifier, Déléguer, Plus tard.
- Filtres par statut, projet et énergie (par exemple « plombantes »), recherche, plusieurs tris.
- **Propositions** : l'application ne planifie jamais seule, elle suggère. Il suffit d'accepter ou d'ignorer (une proposition ignorée revient après 7 jours) :
  - placer les tâches plombantes **le matin**, sur un créneau libre (en tenant compte des rendez-vous Outlook) ;
  - avancer au matin une tâche plombante prévue l'après-midi ;
  - **déléguer** une tâche plombante et peu importante, ou urgente et peu importante, à une personne de l'équipe ;
  - planifier ce qui est urgent et important ;
  - alerter sur les échéances menacées et les journées trop chargées en tâches plombantes.

### Fiche tâche
Elle regroupe : les critères, le statut, le projet, le début et la fin (en heures ou sur plusieurs journées), la durée estimée, l'échéance, le rappel et la délégation. On y gère aussi :
- les **prédécesseurs et successeurs** (lien fin → début, avec un délai en jours ; les boucles sont impossibles) ;
- les **ressources** : personnes (heures), salles, lieux, budgets (montant) et matériel (quantité) ;
- les **sous-tâches** ;
- la **récurrence** : chaque jour, semaine (jours au choix), mois ou année, avec une date de fin. L'occurrence suivante est créée quand on coche la tâche.

### Calendrier
- Vues jour, semaine et mois, de 7 h à 20 h (réglable). La matinée est teintée pour rappeler le créneau idéal des tâches plombantes.
- **Glisser-déposer** : depuis le panneau « À planifier » vers un créneau, pour déplacer un rendez-vous ou pour le redimensionner par le bas. Sur téléphone, il faut faire un appui long avant de glisser.
- Les rendez-vous Outlook s'affichent hachurés, en lecture seule.

### Gantt
- Les barres sont regroupées par projet, avec une barre de synthèse et l'échéance du projet (trait rouge). Les dépendances apparaissent sous forme de flèches.
- Sur ordinateur, on peut glisser une barre pour la déplacer, tirer son bord droit pour changer la durée, ou tirer le rond pour créer un lien vers une autre tâche.
- **Décalage en cascade** : quand une tâche bouge ou prend du retard, tous ses successeurs suivent.
- **En rouge** : les tâches qui finiront après leur échéance, celle d'un successeur ou celle du projet. **Contour orange** : le chemin critique, c'est-à-dire les tâches sans aucune marge.
- **Sur téléphone**, une vue *compacte* est proposée : une carte par projet, une ligne par tâche avec une mini-barre placée sur la durée du projet, les liens « après … » et les alertes. Le Gantt complet reste accessible.
- **Export PDF** : A4 paysage, avec la légende et un tableau des ressources mobilisées.

### Ressources
- La liste des projets avec leur avancement.
- Les personnes, salles, lieux, budgets et matériel, avec les tâches associées et le montant engagé (une alerte signale un dépassement de budget).

### Réglages
- Horaires (début de journée, fin de matinée, fin de journée), jours travaillés et décalage automatique des retards.
- Connexion Microsoft, notifications, thème, installation, sauvegarde et import en fichier `.json`, données d'exemple.

## Report automatique des retards
Au démarrage, puis toutes les 10 minutes, l'application cherche les tâches non terminées dont la fin est passée :
- une tâche courte est reportée au prochain créneau travaillé ;
- une tâche longue voit sa fin prolongée jusqu'à aujourd'hui.

Ses successeurs sont décalés à leur tour. Les tâches qui dépassent alors leur échéance passent en rouge. Ce report peut être désactivé dans les réglages.

## Synchronisation Microsoft 365 (Exchange)

Une seule connexion, votre compte Microsoft 365 :
- tâches **avec une heure précise** → rendez-vous dans l'**agenda Outlook** (avec rappel) ;
- **autres tâches** → liste **« Plannings »** de Microsoft To Do / Tâches Outlook (échéance, statut, importance, rappel) ;
- projets, ressources et réglages → données invisibles attachées à cette liste.

Chaque élément Exchange porte la fiche complète de la tâche : le téléphone (APK) et l'ordinateur (web) partagent les mêmes données. Les modifications faites dans Outlook ou To Do (titre, date, statut, suppression) reviennent dans l'application. Synchronisation automatique à l'ouverture, 5 s après une modification, toutes les 2 minutes et au retour du réseau.

Inscription de l'application (une fois, par un administrateur Microsoft 365) : Entra ID → Inscriptions d'applications → Nouvelle ; comptes de tout annuaire organisationnel et comptes personnels ; plateforme **SPA** avec les URI `https://aventumgroupe.github.io/plannings/` et `https://localhost/` (APK) ; autorisations déléguées Graph `User.Read`, `Calendars.ReadWrite`, `Tasks.ReadWrite` + consentement administrateur.

## Application Android (APK)

Le dossier contient un projet Capacitor (`android/`, `capacitor.config.json`). Le workflow `.github/workflows/plannings-android.yml` construit l'APK à chaque modification et le publie dans « Releases » quand les secrets `SIGNING_KEYSTORE` et `SIGNING_PASSWORD` sont définis. Lien permanent : `https://github.com/AventumGroupe/https-github.com-votre-compte-aventum-heures-conges/releases/latest/download/gestion-plannings.apk`.

## Outlook et synchronisation téléphone ↔ ordinateur

L'application n'a pas de compte propre : c'est la **connexion Microsoft** qui sert à tout.

1. **Outlook dans les deux sens** (Microsoft Graph) :
   - chaque tâche planifiée devient un rendez-vous dans la catégorie « Gestion des plannings », avec son rappel ;
   - un rendez-vous déplacé, modifié ou supprimé dans Outlook met la tâche à jour ;
   - les autres rendez-vous servent à trouver les créneaux libres.
2. **Entre appareils** : les données sont enregistrées dans un fichier privé du dossier *Applications* de votre OneDrive (`gestion-plannings.json`). Chaque appareil fusionne ce fichier avec ses propres données : pour chaque élément, la version la plus récente l'emporte.

La synchronisation est automatique : au démarrage, 4 secondes après chaque modification, toutes les 5 minutes et au retour du réseau.

### Inscription de l'application chez Microsoft (une seule fois)
1. Sur [portal.azure.com](https://portal.azure.com), ouvrir **Microsoft Entra ID → Inscriptions d'applications → Nouvelle inscription**.
2. Types de comptes : « Comptes dans un annuaire organisationnel et comptes Microsoft personnels ».
3. URI de redirection : plateforme **Application monopage (SPA)**, avec l'adresse exacte de l'application (affichée dans les réglages, par exemple `https://<compte>.github.io/<dépôt>/gestion-plannings/`).
4. Autorisations déléguées Microsoft Graph : `Calendars.ReadWrite`, `Files.ReadWrite.AppFolder`, `User.Read`.
5. Copier l'**ID d'application (client)** dans *Réglages → Outlook*, puis cliquer sur « Se connecter ». Faire de même sur le téléphone.

## Rappels
- **Application ouverte** : elle affiche les notifications de rappel et un résumé de la journée à l'heure de début de journée.
- **Application fermée** : ce sont les rappels des rendez-vous Outlook synchronisés qui préviennent, via l'application Outlook du téléphone.

## Installation et hébergement
- C'est un site statique, sans compilation : il suffit d'héberger le dossier `gestion-plannings/` en **HTTPS**. HTTPS est nécessaire pour l'installation, le mode hors connexion et la connexion Microsoft.
  - **GitHub Pages** : *Settings → Pages → Deploy from a branch*. Attention, pour un dépôt privé, il faut une offre GitHub payante.
  - **Plateforme RH existante** : copier le dossier tel quel dans ses fichiers publics.
- **Sur Android** : ouvrir l'adresse dans Chrome, puis menu ⋮ → « Installer l'application ».
- **Pour tester en local** : `python3 -m http.server` dans le dossier, puis ouvrir `http://localhost:8000`.

## Partage en équipe (étape suivante)
Le modèle de données est déjà prêt : les personnes existent comme ressources et la délégation est en place. Pour partager les tâches entre les trois membres de l'équipe, il faudra un stockage commun, par exemple un fichier partagé dans SharePoint/OneDrive via la même connexion Microsoft, ou une base en ligne.

## Fichiers
| Fichier | Rôle |
|---|---|
| `index.html`, `manifest.webmanifest`, `sw.js` | Page d'entrée, manifeste PWA, mode hors connexion |
| `js/store.js` | Données, stockage local, fusion entre appareils |
| `js/sched.js` | Dépendances, cascade, retards, chemin critique, créneaux libres, récurrence |
| `js/suggest.js` | Propositions (énergie, délégation, échéances) |
| `js/list.js`, `js/editor.js` | Liste des tâches et fiche tâche |
| `js/calendar.js`, `js/gantt.js`, `js/resources.js` | Calendrier, Gantt et export PDF, ressources |
| `js/outlook.js`, `js/notify.js` | Microsoft Graph (Outlook, OneDrive), rappels |
| `vendor/msal-browser.min.js` | Bibliothèque de connexion Microsoft (MSAL v4, licence MIT) |
