import { mockCategories, mockFilters, mockMovies } from "./mockData";

export async function getCategories() {
  return mockCategories;
}

export async function getFilters(category: string) {
  return mockFilters[category as keyof typeof mockFilters];
}

export async function getMovies(params: {
  category: string;
  type?: string;
  year?: string;
  region?: string;
}) {
  const result = mockMovies.filter((movie) => {
    return (
      movie.category === params.category &&
      (!params.type || movie.type === params.type) &&
      (!params.year || movie.year === params.year) &&
      (!params.region || movie.region === params.region)
    );
  });

  return {
    list: result,
    total: result.length,
  };
}
