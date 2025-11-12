import {
  Directive,
  ElementRef,
  input,
  OnDestroy,
  Renderer2,
  inject,
  effect,
  computed,
} from '@angular/core';
import { HotkeysService } from '../../services/hotkeys.service';

@Directive({
  selector: '[paTooltip]',
})
export class TooltipDirective implements OnDestroy {
  private readonly el = inject(ElementRef);
  private readonly renderer = inject(Renderer2);
  private readonly hotkeys = inject(HotkeysService);

  readonly paTooltip = input<string>('');
  readonly paTooltipHotkeyId = input<string>('');

  private tooltipElement: HTMLElement | null = null;
  private mouseEnterListener?: () => void;
  private mouseLeaveListener?: () => void;
  private isTooltipVisible = false;

  private readonly currentHotkey = computed(() => {
    const hotkeyId = this.paTooltipHotkeyId();
    if (!hotkeyId) return undefined;
    return this.hotkeys.getBinding(hotkeyId);
  });

  constructor() {
    this.mouseEnterListener = this.renderer.listen(
      this.el.nativeElement,
      'mouseenter',
      () => this.showTooltip(),
    );

    this.mouseLeaveListener = this.renderer.listen(
      this.el.nativeElement,
      'mouseleave',
      () => this.hideTooltip(),
    );

    effect(() => {
      this.currentHotkey();
      if (this.isTooltipVisible) {
        this.updateTooltipContent();
      }
    }, { allowSignalWrites: true });
  }

  private showTooltip(): void {
    const text = this.paTooltip();
    if (!text) return;

    this.isTooltipVisible = true;
    this.createTooltipElement();
    this.updateTooltipContent();
    this.positionTooltip();
  }

  private createTooltipElement(): void {
    if (this.tooltipElement) return;

    this.tooltipElement = this.renderer.createElement('div');
    this.renderer.setStyle(this.tooltipElement, 'position', 'fixed');
    this.renderer.setStyle(this.tooltipElement, 'z-index', '9999');
    this.renderer.setStyle(
      this.tooltipElement,
      'background-color',
      'rgb(23 23 23 / 0.95)',
    );
    this.renderer.setStyle(this.tooltipElement, 'color', 'rgb(250 250 250)');
    this.renderer.setStyle(this.tooltipElement, 'padding', '6px 10px');
    this.renderer.setStyle(this.tooltipElement, 'border-radius', '6px');
    this.renderer.setStyle(this.tooltipElement, 'font-size', '12px');
    this.renderer.setStyle(this.tooltipElement, 'line-height', '1.4');
    this.renderer.setStyle(
      this.tooltipElement,
      'box-shadow',
      '0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)',
    );
    this.renderer.setStyle(this.tooltipElement, 'pointer-events', 'none');
    this.renderer.setStyle(this.tooltipElement, 'white-space', 'nowrap');
    this.renderer.setStyle(
      this.tooltipElement,
      'max-width',
      'min(320px, 90vw)',
    );
    this.renderer.setStyle(this.tooltipElement, 'word-break', 'break-word');

    this.renderer.appendChild(document.body, this.tooltipElement);
  }

  private updateTooltipContent(): void {
    if (!this.tooltipElement) return;

    const text = this.paTooltip();
    const hotkey = this.currentHotkey();

    while (this.tooltipElement.firstChild) {
      this.renderer.removeChild(
        this.tooltipElement,
        this.tooltipElement.firstChild,
      );
    }

    const contentWrapper = this.renderer.createElement('div');
    const textNode = this.renderer.createText(text);
    this.renderer.appendChild(contentWrapper, textNode);

    if (hotkey) {
      const hotkeySpan = this.renderer.createElement('span');
      this.renderer.setStyle(hotkeySpan, 'margin-left', '8px');
      this.renderer.setStyle(hotkeySpan, 'padding', '2px 6px');
      this.renderer.setStyle(
        hotkeySpan,
        'background-color',
        'rgb(63 63 70 / 0.8)',
      );
      this.renderer.setStyle(hotkeySpan, 'border-radius', '4px');
      this.renderer.setStyle(hotkeySpan, 'font-size', '11px');
      this.renderer.setStyle(hotkeySpan, 'font-family', 'monospace');
      this.renderer.setStyle(hotkeySpan, 'color', 'rgb(212 212 216)');

      const hotkeyText = this.renderer.createText(
        this.hotkeys.keyStringToDisplay(hotkey),
      );
      this.renderer.appendChild(hotkeySpan, hotkeyText);
      this.renderer.appendChild(contentWrapper, hotkeySpan);
    }

    this.renderer.appendChild(this.tooltipElement, contentWrapper);
    this.positionTooltip();
  }

  private positionTooltip(): void {
    if (!this.tooltipElement) return;

    const hostRect = this.el.nativeElement.getBoundingClientRect();
    const tooltipRect = this.tooltipElement.getBoundingClientRect();

    const hasDropdownBelow = this.checkForDropdownBelow(hostRect);

    let top: number;
    let left = hostRect.left + hostRect.width / 2 - tooltipRect.width / 2;

    if (hasDropdownBelow || hostRect.top < tooltipRect.height + 16) {
      top = hostRect.top - tooltipRect.height - 8;
    } else {
      top = hostRect.bottom + 8;
      if (top + tooltipRect.height > window.innerHeight) {
        top = hostRect.top - tooltipRect.height - 8;
      }
    }

    if (left < 8) {
      left = 8;
    } else if (left + tooltipRect.width > window.innerWidth - 8) {
      left = window.innerWidth - tooltipRect.width - 8;
    }

    this.renderer.setStyle(this.tooltipElement, 'top', `${top}px`);
    this.renderer.setStyle(this.tooltipElement, 'left', `${left}px`);
  }

  private checkForDropdownBelow(hostRect: DOMRect): boolean {
    const hostElement = this.el.nativeElement;
    const parent = hostElement.parentElement;
    if (!parent) return false;

    const dropdown = parent.querySelector('.dropdown, [data-dropdown], [id*="dropdown"]');
    if (!dropdown) return false;

    const dropdownRect = dropdown.getBoundingClientRect();
    return (
      dropdownRect.top > hostRect.bottom - 10 &&
      dropdownRect.top < hostRect.bottom + 50
    );
  }

  private hideTooltip(): void {
    this.isTooltipVisible = false;
    if (this.tooltipElement) {
      this.renderer.removeChild(document.body, this.tooltipElement);
      this.tooltipElement = null;
    }
  }

  ngOnDestroy(): void {
    this.hideTooltip();
    if (this.mouseEnterListener) this.mouseEnterListener();
    if (this.mouseLeaveListener) this.mouseLeaveListener();
  }
}
