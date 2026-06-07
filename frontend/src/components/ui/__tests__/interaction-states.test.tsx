import { render, screen } from "@testing-library/react";
import { afterAll, beforeAll, vi } from "vitest";
import { Button } from "../button";
import { Card } from "../card";
import {
  Command,
  CommandItem,
  CommandList,
} from "../command";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "../dropdown-menu";

class ResizeObserverMock {
  disconnect = vi.fn();
  observe = vi.fn();
  unobserve = vi.fn();
}

describe("shared interaction states", () => {
  const originalScrollIntoView = HTMLElement.prototype.scrollIntoView;

  beforeAll(() => {
    vi.stubGlobal("ResizeObserver", ResizeObserverMock);
    HTMLElement.prototype.scrollIntoView = vi.fn();
  });

  afterAll(() => {
    vi.unstubAllGlobals();
    HTMLElement.prototype.scrollIntoView = originalScrollIntoView;
  });

  it("applies the primary hover recipe to outline-style button variants", () => {
    render(
      <>
        <Button variant="outline">Outline</Button>
        <Button variant="secondary">Secondary</Button>
        <Button variant="ghost">Ghost</Button>
      </>,
    );

    expect(screen.getByRole("button", { name: "Outline" })).toHaveClass(
      "interactive-hover-primary",
    );
    expect(screen.getByRole("button", { name: "Secondary" })).toHaveClass(
      "interactive-hover-primary",
    );
    expect(screen.getByRole("button", { name: "Ghost" })).toHaveClass(
      "interactive-hover-primary",
    );
  });

  it("lets cards opt into the structural hover treatment", () => {
    render(<Card data-interactive="true">Interactive panel</Card>);

    expect(screen.getByText("Interactive panel").closest('[data-slot="card"]'))
      .toHaveClass("interactive-hover-structural");
  });

  it("applies shared hover utilities to command rows and dropdown menu items", () => {
    render(
      <>
        <Command>
          <CommandList>
            <CommandItem>Search result</CommandItem>
          </CommandList>
        </Command>

        <DropdownMenu open>
          <DropdownMenuTrigger>Open menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Account</DropdownMenuItem>
            <DropdownMenuItem variant="destructive">Log out</DropdownMenuItem>
            <DropdownMenuSub open>
              <DropdownMenuSubTrigger>More</DropdownMenuSubTrigger>
              <DropdownMenuSubContent>
                <DropdownMenuItem>Nested action</DropdownMenuItem>
              </DropdownMenuSubContent>
            </DropdownMenuSub>
          </DropdownMenuContent>
        </DropdownMenu>
      </>,
    );

    expect(screen.getByText("Search result").closest('[data-slot="command-item"]'))
      .toHaveClass("interactive-hover-primary");
    expect(screen.getByRole("menuitem", { name: /^Account$/i })).toHaveClass(
      "interactive-hover-primary",
    );
    expect(screen.getByRole("menuitem", { name: /log out/i })).toHaveClass(
      "interactive-hover-destructive",
    );
    expect(screen.getByText("More").closest('[data-slot="dropdown-menu-sub-trigger"]'))
      .toHaveClass("interactive-hover-primary");
  });
});
