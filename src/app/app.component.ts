import { Component, signal, computed, effect, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import { marked } from 'marked';
import DOMPurify from 'dompurify';
import TurndownService from 'turndown';


@Component({
  standalone: true,
  selector: 'app-root',
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit{
  text = signal('ahoj jakso mas? dneska som bol v obchode a kupil som chlieb a rohliky ale predavacka bola dost neochotna a vravela ze nema vydavok. tiez som zabudol kupit mlieko co ma dost stvalo lebo deti budu chcet kakao. mozno zajtra pojdem zase do obchodu ked budem mat cas.');
  raw_text = signal('')
  instructions = signal('');
  moods_text = signal('');
  moods = [
    { name: 'Priateľský', checked: false },
    { name: 'Profesionálny', checked: true },
    { name: 'Veselý', checked: false },
    { name: 'Odmeraný', checked: false },
    { name: 'Markdown', checked: false },
    { name: 'Stručný', checked: false },
    { name: 'Detailný', checked: false },
    { name: 'Vo formáte Markdown', checked: false },
  ]


  busy = signal(false);
  private td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });




  previewHtml = computed<SafeHtml>(() => {
    const raw = marked.parse(this.raw_text() ?? '', { async: false }) as string; // ← dôležité
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });
    return this.sanitizer.bypassSecurityTrustHtml(clean);
  });

  constructor(private sanitizer: DomSanitizer) {

  }
  
  ngOnInit(): void {
    this.onMoodChange();
  }

  async pasteFromClipboard() {
    try {
      // Preferuj HTML, fallback na text
      // @ts-ignore – typy Clipboard API sú neúplné
      const items: ClipboardItems = await navigator.clipboard.read?.();
      if (items && items.length) {
        const htmlItem = items.find(i => i.types?.includes('text/html'));
        if (htmlItem) {
          const blob = await htmlItem.getType('text/html');
          const html = await blob.text();
          this.text.set(this.td.turndown(html)); // HTML → Markdown
          return;
        }
      }
      const txt = await navigator.clipboard.readText();
      this.text.set(txt);
    } catch {
      // Fallback pre prostredia, kde je read() blokované – necháme userovi Ctrl+V
    }
  }

  async copyAsHtml() {
    const raw = marked.parse(this.text() ?? '', { async: false }) as string; // ← tu
    const clean = DOMPurify.sanitize(raw, { USE_PROFILES: { html: true } });

    // Orez na „email-safe“ HTML (tu zatiaľ len sanitácia; profil zúžime neskôr)
    const html = `<!DOCTYPE html><html><body>${clean}</body></html>`;

    // Copy as text/html
    const blob = new Blob([html], { type: 'text/html' });
    // @ts-ignore
    await navigator.clipboard.write?.([new ClipboardItem({ 'text/html': blob })])
      .catch(async () => { await navigator.clipboard.writeText(html); });
  }

  async correctWithGemini(mode: string = '') {

    const input = this.text()?.trim();
    if (!input || this.busy()) return;
    const moods = this.moods_text()?.trim();
    const instruction = this.instructions()?.trim();
    const strs: String[] = [];
    if( moods){
      strs.push(moods);
    }
    if( instruction){
      strs.push(instruction);
    }

    const all_istructions = strs.join('\n');

    this.busy.set(true);
    try {
      const resp = await fetch('/api/correct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: input, instruction: all_istructions })
      });

      console.log(`all_istructions: ${all_istructions}`);


      if (!resp.ok) throw new Error('API error ' + resp.status);
      const { corrected } = await resp.json();
      if (typeof corrected === 'string' && corrected.trim().length > 0) {
        this.raw_text.set(corrected);
      }
    } catch (e) {
      console.error(e);
      // necháme pôvodný text; prípadne toast/alert
    } finally {
      this.busy.set(false);
    }
  }

  toMarkdown() {
  }

  onMoodChange() {
    const moods = this.moods.filter(i => i.checked).map(i => i.name);
    console.log(moods)
    const txt = moods.length ? `Transformuj text tak aby bol: ${moods.join(', ')}.` : '';
    this.moods_text.set(txt);

}





}
