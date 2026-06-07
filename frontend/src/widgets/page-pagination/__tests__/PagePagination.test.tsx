import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/render-with-providers";
import { PagePagination } from "../PagePagination";

describe("PagePagination", () => {
  const onPageChange = vi.fn();

  beforeEach(() => {
    onPageChange.mockClear();
  });

  it("renders nothing when totalPages is 1", () => {
    const { container } = renderWithProviders(
      <PagePagination currentPage={1} totalPages={1} onPageChange={onPageChange} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when totalPages is 0", () => {
    const { container } = renderWithProviders(
      <PagePagination currentPage={1} totalPages={0} onPageChange={onPageChange} />,
    );
    expect(container.innerHTML).toBe("");
  });

  it("renders page numbers for multiple pages", () => {
    renderWithProviders(
      <PagePagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );
    expect(screen.getByText("1")).toBeInTheDocument();
    expect(screen.getByText("2")).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();
  });

  it("does not render Previous button on first page", () => {
    renderWithProviders(
      <PagePagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );
    expect(screen.queryByRole("link", { name: /previous/i })).not.toBeInTheDocument();
  });

  it("renders Previous button when not on first page", () => {
    renderWithProviders(
      <PagePagination currentPage={2} totalPages={3} onPageChange={onPageChange} />,
    );
    expect(screen.getByRole("link", { name: /previous/i })).toBeInTheDocument();
  });

  it("does not render Next button on last page", () => {
    renderWithProviders(
      <PagePagination currentPage={3} totalPages={3} onPageChange={onPageChange} />,
    );
    expect(screen.queryByRole("link", { name: /next/i })).not.toBeInTheDocument();
  });

  it("renders Next button when not on last page", () => {
    renderWithProviders(
      <PagePagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );
    expect(screen.getByRole("link", { name: /next/i })).toBeInTheDocument();
  });

  it("calls onPageChange when a page number is clicked", () => {
    renderWithProviders(
      <PagePagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByText("2"));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("calls onPageChange with previous page when Previous is clicked", () => {
    renderWithProviders(
      <PagePagination currentPage={2} totalPages={3} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByRole("link", { name: /previous/i }));
    expect(onPageChange).toHaveBeenCalledWith(1);
  });

  it("calls onPageChange with next page when Next is clicked", () => {
    renderWithProviders(
      <PagePagination currentPage={1} totalPages={3} onPageChange={onPageChange} />,
    );
    fireEvent.click(screen.getByRole("link", { name: /next/i }));
    expect(onPageChange).toHaveBeenCalledWith(2);
  });

  it("applies alignment class", () => {
    const { container } = renderWithProviders(
      <PagePagination
        currentPage={1}
        totalPages={3}
        onPageChange={onPageChange}
        align="start"
      />,
    );
    expect(container.querySelector(".justify-start")).toBeInTheDocument();
  });
});
