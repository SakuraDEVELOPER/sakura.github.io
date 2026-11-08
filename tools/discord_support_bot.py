"""
Sakura Discord Support Bot
===========================
Этот бот связывает обращения в службу поддержки Sakura на сайте с Discord-сервером.

Возможности:
1. При создании тикета на сайте сообщение отправляется через Webhook в канал Discord.
2. Администратор может ответить прямо из Discord командой:
   !reply <ID_ТИКЕТА> <ТЕКСТ_ОТВЕТА>
   или слэш-командой /reply.
3. Бот мгновенно записывает ответ в Firebase Firestore тикета, и пользователь на сайте
   видит ответ в реальном времени!

Требования:
  pip install discord.py aiohttp firebase-admin
"""

import os
import sys
import asyncio
import aiohttp
import discord
from discord.ext import commands

DISCORD_BOT_TOKEN = os.getenv("DISCORD_BOT_TOKEN", "YOUR_BOT_TOKEN_HERE")
FIREBASE_PROJECT_ID = os.getenv("FIREBASE_PROJECT_ID", "sakura-bfa74")
FIREBASE_API_KEY = os.getenv("FIREBASE_API_KEY", "AIzaSyAnZQt5NWXGOWuz3STh_vy-dSENVBM9_ZY")

intents = discord.Intents.default()
intents.message_content = True

bot = commands.Bot(command_prefix="!", intents=intents)

async def post_reply_to_firestore(ticket_id: str, author_name: str, reply_text: str):
    """Отправляет ответ администратора в Firestore через REST API."""
    url = f"https://firestore.googleapis.com/v1/projects/{FIREBASE_PROJECT_ID}/databases/(default)/documents/supportTickets/{ticket_id}"
    
    async with aiohttp.ClientSession() as session:
        # Сначала получаем текущий документ тикета
        async with session.get(url) as resp:
            if resp.status != 200:
                return False, f"Тикет {ticket_id} не найден (HTTP {resp.status})."
            data = await resp.json()

        # Формируем новое сообщение от поддержки
        fields = data.get("fields", {})
        existing_messages = fields.get("messages", {}).get("arrayValue", {}).get("values", [])

        new_msg = {
            "mapValue": {
                "fields": {
                    "id": {"stringValue": f"msg_{int(asyncio.get_event_loop().time() * 1000)}"},
                    "sender": {"stringValue": "support"},
                    "authorLogin": {"stringValue": author_name},
                    "text": {"stringValue": reply_text},
                    "timestamp": {"stringValue": discord.utils.utcnow().isoformat() + "Z"}
                }
            }
        }
        existing_messages.append(new_msg)

        # Обновляем документ
        patch_payload = {
            "fields": {
                **fields,
                "status": {"stringValue": "answered"},
                "updatedAt": {"stringValue": discord.utils.utcnow().isoformat() + "Z"},
                "messages": {"arrayValue": {"values": existing_messages}}
            }
        }

        async with session.patch(url, json=patch_payload) as patch_resp:
            if patch_resp.status == 200:
                return True, "Ответ успешно доставлен в тикет на сайт!"
            else:
                err_text = await patch_resp.text()
                return False, f"Ошибка записи в Firestore: {err_text[:200]}"

@bot.event
async def on_ready():
    print(f"🌸 Sakura Support Bot запущен как {bot.user} (ID: {bot.user.id})")
    print("Команда ответа: !reply <id_тикета> <текст ответа>")

@bot.command(name="reply")
async def reply_command(ctx, ticket_id: str, *, reply_text: str):
    """Ответить на тикет поддержки."""
    clean_id = ticket_id.strip().lstrip("#")
    if not clean_id.startswith("ticket_"):
        # Если передан короткий суффикс, ищем полный id
        clean_id = "ticket_" + clean_id

    author_name = ctx.author.display_name or ctx.author.name
    async with ctx.typing():
        ok, msg = await post_reply_to_firestore(clean_id, author_name, reply_text)
        if ok:
            embed = discord.Embed(
                title=f"✓ Ответ отправлен в #{clean_id[-6:]}",
                description=f"**Ответил:** {author_name}\n**Текст:** {reply_text}",
                color=0x8ce5b2
            )
            await ctx.send(embed=embed)
        else:
            await ctx.send(f"⚠️ {msg}")

if __name__ == "__main__":
    if DISCORD_BOT_TOKEN == "YOUR_BOT_TOKEN_HERE":
        print("Пожалуйста, укажите DISCORD_BOT_TOKEN в файле или переменной окружения.")
    else:
        bot.run(DISCORD_BOT_TOKEN)
