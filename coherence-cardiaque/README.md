# Souffle d'Horizon

Application web de cohérence cardiaque inspirée de la méthode **365** du Dr David O'Hare :
**3** fois par jour, **6** respirations par minute, **5** minutes.

Au lieu de la classique boule qui monte et descend, ce sont des **paysages vivants** qui guident le souffle :

| Paysage | Inspiration | Expiration |
|---|---|---|
| Marée | la marée monte : l'eau gagne la plage et grimpe le long du ponton | la marée descend et découvre le sable |
| Aube | le soleil se lève, le ciel s'éclaire | il redescend, les étoiles reviennent |
| Lotus | la fleur s'ouvre, des lucioles s'élèvent | elle se referme doucement |
| Aurore | l'aurore boréale s'élève et s'intensifie | elle s'apaise au-dessus du lac |

## Fonctionnalités

- Rythmes : Équilibre 5 s / 5 s, Apaisement 4 s / 6 s (expiration longue), Découverte 4 s / 5 s, ou sur mesure.
- Durées : 3, 5 (recommandé) ou 10 minutes ; la séance se termine toujours sur un cycle complet.
- Accompagnement au choix : musique zen (bourdon grave et notes de handpan en gamme pentatonique, longue réverbération), sons de nature qui suivent le souffle (la vague gronde en montant, l'écume pétille en redescendant), bol chantant, voix (« Inspirez / Expirez »), vibration (Android), mots à l'écran.
- Suivi 365 : trois créneaux du jour (matin, midi, soir) et les 7 derniers jours, stockés localement dans le navigateur.
- Ressenti en fin de séance, écran maintenu allumé pendant la séance, raccourcis clavier (Espace = pause, Échap = arrêter).

Tous les paysages sont dessinés en temps réel (Canvas), sans image externe ni dépendance.

## Utilisation

Ouvrir `index.html` dans un navigateur (ordinateur ou téléphone). `souffle.html` est le même contenu sans l'en-tête HTML, utilisé pour la publication en artifact.

> Cette application ne remplace pas un avis médical. En cas de vertige, reprendre une respiration naturelle.
