#!/usr/bin/env bash
#
# SEO Suite skill'lerini ~/.claude/skills/ altına kopyalar.
#
# Bu betik, Claude Code'un eklenti (plugin) altyapısını kullanmak istemeyenler
# içindir. Eklenti kurulumu tercih edilirse README'deki
#   /plugin marketplace add eraysenel/ceo-my-world
# yolu daha iyidir: sürüm takibi ve güncelleme sağlar.

set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC_DIR="$REPO_ROOT/plugins/seo-suite/skills"
DEST_DIR="${CLAUDE_SKILLS_DIR:-$HOME/.claude/skills}"

LIST_ONLY=0
FORCE=0

usage() {
  cat <<'EOF'
Kullanım: ./scripts/install.sh [seçenekler]

  --list     Ne kopyalanacağını gösterir, hiçbir şey yazmaz
  --force    Hedefte aynı isimde skill varsa üzerine yazar
  --help     Bu yardımı gösterir

Ortam değişkeni:
  CLAUDE_SKILLS_DIR   Hedef dizin (varsayılan: ~/.claude/skills)
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    --list)  LIST_ONLY=1; shift ;;
    --force) FORCE=1; shift ;;
    --help|-h) usage; exit 0 ;;
    *) echo "Bilinmeyen seçenek: $1" >&2; usage >&2; exit 1 ;;
  esac
done

if [[ ! -d "$SRC_DIR" ]]; then
  echo "HATA: skill dizini bulunamadı: $SRC_DIR" >&2
  exit 1
fi

# Skill dizinleri = içinde SKILL.md olan alt dizinler
mapfile -t SKILLS < <(find "$SRC_DIR" -mindepth 2 -maxdepth 2 -name SKILL.md -printf '%h\n' | sort)

if [[ ${#SKILLS[@]} -eq 0 ]]; then
  echo "HATA: $SRC_DIR altında SKILL.md içeren dizin yok." >&2
  exit 1
fi

echo "Kaynak : $SRC_DIR"
echo "Hedef  : $DEST_DIR"
echo "Skill  : ${#SKILLS[@]} adet"
echo

for skill_path in "${SKILLS[@]}"; do
  name="$(basename "$skill_path")"
  target="$DEST_DIR/$name"

  if [[ $LIST_ONLY -eq 1 ]]; then
    echo "  $name -> $target"
    continue
  fi

  if [[ -e "$target" && $FORCE -eq 0 ]]; then
    echo "  ATLANDI  $name (zaten var; üzerine yazmak için --force)"
    continue
  fi

  mkdir -p "$DEST_DIR"
  rm -rf "$target"
  cp -R "$skill_path" "$target"
  echo "  KURULDU  $name"
done

if [[ $LIST_ONLY -eq 1 ]]; then
  echo
  echo "(--list modu: hiçbir dosya yazılmadı)"
else
  echo
  echo "Bitti. Claude Code'u yeniden başlatın; skill'ler /<isim> ile çağrılabilir."
fi
