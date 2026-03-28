const { default: makeWASocket, useSingleFileAuthState } = require("@whiskeysockets/baileys");
const sqlite3 = require('sqlite3').verbose();
const { state, saveState } = useSingleFileAuthState('./auth.json');

// Créateur du bot (remplace par ton numéro WhatsApp !)
const CREATOR_NAME = "Ashle";
const CREATOR_PHONE = "22998765432@s.whatsapp.net"; // ← Ton numéro ici !

const BOT_NAME = "Samantha";
const GROUP_LABEL = "Otaku";

// Règles : mots interdits
const FORBIDDEN_WORDS = ["insulte", "spoiler", "porn", "nazi", "pub"]; // Modifie selon tes besoins

// Initialisation BDD
const db = new sqlite3.Database('otaku.sqlite');
db.serialize(() => {
  db.run("CREATE TABLE IF NOT EXISTS groups (id TEXT PRIMARY KEY, name TEXT)");
  db.run("CREATE TABLE IF NOT EXISTS members (id TEXT, group_id TEXT, PRIMARY KEY(id, group_id))");
  db.run("CREATE TABLE IF NOT EXISTS games (name TEXT, group_id TEXT, creator TEXT, PRIMARY KEY(name, group_id))");
});

async function startBot() {
  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });
  sock.ev.on('creds.update', saveState);

  // Ajouter groupe/membres dans la BDD
  sock.ev.on('group-participants.update', async (update) => {
    const { id: groupId, participants, action } = update;

    if (action === "add") {
      db.run("INSERT OR IGNORE INTO groups(id, name) VALUES(?, ?)", [groupId, groupId]);
      participants.forEach(pid =>
        db.run("INSERT OR IGNORE INTO members(id, group_id) VALUES(?, ?)", [pid, groupId])
      );
      await sock.sendMessage(groupId, {
        text: `Bienvenue à ${participants.join(", ")} dans le groupe ${GROUP_LABEL} !\nJe suis ${BOT_NAME}, bot admin créé par ${CREATOR_NAME}.\nEnvoyez *!help* pour les commandes 👾.`
      });
    }
    if (action === "remove") {
      participants.forEach(pid =>
        db.run("DELETE FROM members WHERE id=? AND group_id=?", [pid, groupId])
      );
    }
  });

  // Répondre aux messages dans les groupes
  sock.ev.on('messages.upsert', async ({ messages }) => {
    const msg = messages[0];
    if (!msg.message) return;
    const from = msg.key.remoteJid;
    const sender = msg.key.participant || msg.key.remoteJid;

    db.get("SELECT name FROM groups WHERE id=?", [from], async (err, row) => {
      if (row) {
        const text = msg.message.conversation?.trim() || "";

        // Vérification INFRACTION et auto-kick
        const lowered = text.toLowerCase();
        for (let forbidden of FORBIDDEN_WORDS) {
          if (lowered.includes(forbidden)) {
            // Ashle ne peut pas être kické
            if (sender !== CREATOR_PHONE) {
              await sock.sendMessage(from, { 
                text: `Règle violée : le mot "${forbidden}" est interdit. ${BOT_NAME} va expulser ${sender} du groupe !`
              });
              await sock.groupParticipantsUpdate(from, [sender], "remove");
              return; // Stop processing after kick
            }
          }
        }

        // Les autres commandes et fonctionnalités du bot suivent ici (comme dans la réponse précédente)...
        // ... (voir plus haut pour code complet commandes !help, !jeux, !creerjeu, !deljeu, etc.)

        if (text.toLowerCase() === "!help") {
          await sock.sendMessage(from, {
            text: `🤖 *${BOT_NAME}* - bot du groupe ${GROUP_LABEL}\n\nCréateur : *${CREATOR_NAME}*\nCertaines commandes sont réservées à Ashle (l'admin)\n
Commandes : 
!members - Afficher la liste des membres
!jeux - Lister les jeux du groupe
!creerjeu [nomjeu] - (*Ashle seulement*) Créer un jeu
!deljeu [nomjeu] - (*Ashle seulement*) Supprimer un jeu
!kick numero@s.whatsapp.net - (*Ashle seulement*) Bannir un membre
Règle : Mots interdits détectés, exclusion automatique possible !`
          });
        }
      }
    });
  });
}
startBot();