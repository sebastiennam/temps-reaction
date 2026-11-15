@echo off
rem Lance l'application en local (mode démo) : double-cliquez sur ce fichier.
rem Nécessite Node.js (déjà installé sur cet ordinateur). Fermez la fenêtre noire pour arrêter.
cd /d "%~dp0"
start "" http://localhost:8642/
node outils\serveur-local.js "%~dp0." 8642
