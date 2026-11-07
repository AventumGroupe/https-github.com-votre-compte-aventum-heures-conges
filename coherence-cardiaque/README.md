# Cohérence cardiaque

Application web de cohérence cardiaque inspirée de la méthode **365** du Dr David O'Hare :
**3** fois par jour, **6** respirations par minute, **5** minutes.

Au lieu de la classique boule qui monte et descend, ce sont des **paysages vivants** qui guident le souffle :

| Paysage | Inspiration | Expiration |
|---|---|---|
| Marée | la marée monte : l'eau gagne la plage et grimpe le long du ponton | la marée descend et découvre le sable |
| Aube | le soleil se lève, le ciel s'éclaire | il redescend, les étoiles reviennent |
| Lotus | la fleur s'ouvre, des lucioles s'élèvent | elle se referme doucement |
| Aurore | l'aurore boréale s'élève et s'intensifie | elle s'apaise au-dessus du lac |
| Papillon | il ouvre ses ailes, posé sur une fleur | il les referme |

## Fonctionnalités

- Les cinq paysages se succèdent automatiquement, un par minute, avec un fondu enchaîné au début d'une inspiration.
- Réglages par curseurs :
  - Rythme : Découverte 4 s / 5 s, Équilibre 5 s / 5 s, Apaisement 4 s / 6 s (expiration longue).
  - Durée : de 1 à 10 minutes (5 minutes pour la méthode 365).
  - Son : silence, bol chantant, musique douce, ou musique et bol.
  - Volume.
  - Consignes : image seule, mots à l'écran, ou mots et voix.
- Son volontairement épuré : uniquement des sons purs (accord tenu qui enfle à l'inspiration, rares notes pentatoniques, bol chantant), sans bruit synthétique.
- Suivi 365 : trois créneaux du jour (matin, midi, soir) et les 7 derniers jours, stockés localement dans le navigateur.
- Ressenti en fin de séance, écran maintenu allumé pendant la séance, raccourcis clavier (Espace = pause, Échap = arrêter).

Tous les paysages sont dessinés en temps réel (Canvas), sans image externe ni dépendance.

## Utilisation

Ouvrir `index.html` dans un navigateur (ordinateur ou téléphone). `souffle.html` est le même contenu sans l'en-tête HTML, utilisé pour la publication en artifact.

> Cette application ne remplace pas un avis médical. En cas de vertige, reprendre une respiration naturelle.
