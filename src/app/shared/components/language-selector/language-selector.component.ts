import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  OnInit,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { TranslocoPipe, TranslocoService } from '@jsverse/transloco';
import { UserSettingsService } from '../../../services/user-settings.service';
import { NgIcon } from '@ng-icons/core';

interface Language {
  code: string;
  name: string;
}

@Component({
  selector: 'pa-language-selector',
  templateUrl: './language-selector.component.html',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [TranslocoPipe, NgIcon],
  host: {
    class: 'relative inline-flex items-center',
    '(document:click)': 'onDocumentClick($event)',
    '(document:keydown.escape)': 'onEscapeKey()',
  },
})
export class LanguageSelectorComponent implements OnInit {
  private readonly transloco = inject(TranslocoService);
  private readonly settings = inject(UserSettingsService);
  private readonly elementRef = inject(ElementRef);
  private readonly destroyRef = inject(DestroyRef);

  readonly isDropdownOpen = signal(false);
  readonly currentLang = signal(this.transloco.getActiveLang());

  readonly availableLanguages: Language[] = [
    { code: 'en', name: 'English' },
    { code: 'vi', name: 'Tiếng Việt' },
    { code: 'zh', name: '中文' },
    { code: 'es', name: 'Español' },
    { code: 'fr', name: 'Français' },
    { code: 'de', name: 'Deutsch' },
    { code: 'ru', name: 'Русский' },
    { code: 'ja', name: '日本語' },
    { code: 'ko', name: '한국어' },
    { code: 'th', name: 'ภาษาไทย' },
    { code: 'pt', name: 'Português' },
    { code: 'it', name: 'Italiano' },
    { code: 'ar', name: 'العربية' },
    { code: 'hi', name: 'हिन्दी' },
  ];

  readonly primaryLanguages = ['en', 'vi'];

  readonly otherLanguages = computed(() =>
    this.availableLanguages.filter(
      (lang) => !this.primaryLanguages.includes(lang.code)
    )
  );

  ngOnInit(): void {
    this.transloco.langChanges$
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((lang) => {
        this.currentLang.set(lang);
      });
  }

  onDocumentClick(event: MouseEvent): void {
    if (
      event.target &&
      !this.elementRef.nativeElement.contains(event.target as Node)
    ) {
      this.isDropdownOpen.set(false);
    }
  }

  onEscapeKey(): void {
    this.isDropdownOpen.set(false);
  }

  selectLanguage(langCode: string): void {
    this.settings.setLanguage(langCode);
    this.isDropdownOpen.set(false);
  }

  toggleDropdown(): void {
    this.isDropdownOpen.update((open) => !open);
  }

  isCurrentLang(langCode: string): boolean {
    return this.currentLang() === langCode;
  }

  getLanguageName(code: string): string {
    const lang = this.availableLanguages.find((l) => l.code === code);
    return lang?.name || code.toUpperCase();
  }
}
