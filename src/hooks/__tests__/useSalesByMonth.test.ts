import { renderHook, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { useSalesByMonth } from "../useSalesByMonth";
import { supabase } from "@/integrations/supabase/client";

// Mock the supabase client
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(function (this: any) {
        this._select = this._select || [];
        return this;
      }),
      gte: vi.fn(function (this: any) {
        this._gte = this._gte || {};
        return this;
      }),
      lte: vi.fn(function (this: any) {
        this._lte = this._lte || {};
        return this;
      }),
      eq: vi.fn(function (this: any) {
        this._eq = this._eq || {};
        return this;
      }),
      // Add helper to execute query
      _execute: vi.fn(),
    })),
  },
}));

describe("useSalesByMonth", () => {
  const mockSalesData = [
    { created_at: "2025-01-15T10:30:00Z" },
    { created_at: "2025-01-20T14:45:00Z" },
    { created_at: "2025-02-05T09:15:00Z" },
    { created_at: "2025-02-10T16:20:00Z" },
    { created_at: "2025-02-25T11:00:00Z" },
  ];

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should fetch sales data grouped by month", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      data: mockSalesData,
      error: null,
    });

    // Configure chain mock
    const mockFrom = supabase.from as any;
    mockFrom.mockReturnValue({
      _select: ["created_at"],
      _gte: {},
      _lte: {},
      _eq: {},
      _execute: mockExec,
    });

    const { result } = renderHook(() => useSalesByMonth());

    expect(result.current.loading).toBe(true);

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).toBeNull();
    expect(result.current.data).toHaveLength(12); // Last 12 months

    // Check that January has 2 sales
    const januaryData = result.current.data.find(d => d.month === "2025-01");
    expect(januaryData?.count).toBe(2);

    // Check that February has 3 sales
    const februaryData = result.current.data.find(d => d.month === "2025-02");
    expect(februaryData?.count).toBe(3);
  });

  it("should respect empresaId filter", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      data: mockSalesData,
      error: null,
    });

    const mockFrom = supabase.from as any;
    mockFrom.mockReturnValue({
      _select: ["created_at"],
      _gte: {},
      _lte: {},
      _eq: { empresa_id: "test-empresa-123" },
      _execute: mockExec,
    });

    renderHook(() => useSalesByMonth({ empresaId: "test-empresa-123" }));

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    // Verify eq was called with empresa_id
    const mockInstance = mockFrom.mock.results[0].value;
    expect(mockInstance._eq).toEqual({ empresa_id: "test-empresa-123" });
  });

  it("should handle empty data correctly", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      data: [],
      error: null,
    });

    const mockFrom = supabase.from as any;
    mockFrom.mockReturnValue({
      _select: ["created_at"],
      _gte: {},
      _lte: {},
      _eq: {},
      _execute: mockExec,
    });

    const { result } = renderHook(() => useSalesByMonth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.data).toHaveLength(12);
    result.current.data.forEach(month => {
      expect(month.count).toBe(0);
    });
  });

  it("should handle errors gracefully", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      data: null,
      error: { message: "Database error" },
    });

    const mockFrom = supabase.from as any;
    mockFrom.mockReturnValue({
      _select: ["created_at"],
      _gte: {},
      _lte: {},
      _eq: {},
      _execute: mockExec,
    });

    const { result } = renderHook(() => useSalesByMonth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.data).toHaveLength(12);
  });

  it("should exclude non-completed sales", async () => {
    const mockExec = vi.fn().mockResolvedValue({
      data: [
        { created_at: "2025-01-15T10:30:00Z", status: "completed" },
        { created_at: "2025-01-20T14:45:00Z", status: "completed" },
        { created_at: "2025-01-25T11:00:00Z", status: "cancelled" },
      ],
      error: null,
    });

    const mockFrom = supabase.from as any;
    mockFrom.mockReturnValue({
      _select: ["created_at"],
      _gte: {},
      _lte: {},
      _eq: { status: "completed" },
      _execute: mockExec,
    });

    renderHook(() => useSalesByMonth());

    await waitFor(() => {
      expect(result.current.loading).toBe(false);
    });

    const januaryData = result.current.data.find(d => d.month === "2025-01");
    expect(januaryData?.count).toBe(2); // Only the 2 completed sales
  });
});
