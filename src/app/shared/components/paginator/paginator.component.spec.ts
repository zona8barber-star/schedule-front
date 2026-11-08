import { Component, signal } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';

import { PaginatorComponent } from './paginator.component';

@Component({
  imports: [PaginatorComponent],
  template: `
    <app-paginator
      label="Paginación de prueba"
      [page]="page()"
      [pageSize]="pageSize()"
      [totalCount]="totalCount()"
      [pageSizeOptions]="sizes()"
      [disabled]="disabled()"
      (pageChange)="pages.push($event)"
      (pageSizeChange)="sizesChosen.push($event)"
    />
  `,
})
class HostComponent {
  readonly page = signal(1);
  readonly pageSize = signal(20);
  readonly totalCount = signal(45);
  readonly sizes = signal<number[]>([]);
  readonly disabled = signal(false);
  readonly pages: number[] = [];
  readonly sizesChosen: number[] = [];
}

describe('PaginatorComponent', () => {
  let fixture: ComponentFixture<HostComponent>;
  let host: HostComponent;

  function element(): HTMLElement {
    return fixture.nativeElement as HTMLElement;
  }

  function button(label: string): HTMLButtonElement {
    return element().querySelector(`button[aria-label="${label}"]`) as HTMLButtonElement;
  }

  beforeEach(async () => {
    await TestBed.configureTestingModule({ imports: [HostComponent] }).compileComponents();
    fixture = TestBed.createComponent(HostComponent);
    host = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('is an accessible navigation that shows the range, the current page and the total', () => {
    const nav = element().querySelector('nav')!;
    expect(nav.getAttribute('aria-label')).toBe('Paginación de prueba');
    expect(nav.textContent).toContain('1–20 de 45');
    expect(nav.textContent).toContain('Página 1 de 3');
    expect(element().querySelector('[aria-current="page"]')?.textContent?.trim()).toBe('1');
    expect(button('Página anterior').disabled).toBe(true);
    expect(button('Página siguiente').disabled).toBe(false);
  });

  it('emits the next and previous pages and disables the last step', () => {
    button('Página siguiente').click();
    expect(host.pages).toEqual([2]);

    host.page.set(3);
    fixture.detectChanges();
    expect(element().textContent).toContain('41–45 de 45');
    expect(button('Página siguiente').disabled).toBe(true);

    button('Página anterior').click();
    expect(host.pages).toEqual([2, 2]);
  });

  it('hides itself when there is nothing to page', () => {
    host.totalCount.set(0);
    fixture.detectChanges();
    expect(element().querySelector('nav')).toBeNull();
  });

  it('never emits while disabled', () => {
    host.disabled.set(true);
    fixture.detectChanges();
    expect(button('Página siguiente').disabled).toBe(true);
    fixture.debugElement.children[0].componentInstance.goTo(2);
    expect(host.pages).toEqual([]);
  });

  it('offers the page sizes only when given and emits the chosen one', () => {
    expect(element().querySelector('select')).toBeNull();

    host.sizes.set([20, 50, 100]);
    fixture.detectChanges();
    const select = element().querySelector('select') as HTMLSelectElement;
    select.value = '50';
    select.dispatchEvent(new Event('change'));
    expect(host.sizesChosen).toEqual([50]);
  });
});
