# Webuddhist Studio Frontend

## Endpoints

> Dev
> https://studio-dev-frontend.onrender.com

> Test
> https://studio-tst-frontend.onrender.com

This is the frontend application for the Webuddhist Studio platform, designed to manage and interact with Buddhist texts in the OpenPecha format.

## Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

## Installation

1. Clone the repository:

   ```bash
   git clone https://github.com/OpenPecha/plan_frontend
   ```

2. Navigate to app-pecha-frontend directory:

   ```bash
   cd plan_frontend
   ```

3. Install the dependencies:
   ```bash
   npm install
   ```
4. Create your environment variables file:

   ```bash
   cp .env.example .env
   ```

## Development

1. Start the development server:

   ```bash
   npm run dev
   ```

   The application will be available at [http://localhost:5173](http://localhost:5173)

2. Run the test cases:
   ```bash
   npm run test
   ```

## Available Scripts

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run preview` - Preview production build
- `npm run lint` - Run ESLint
- `npm run test` - Run tests
- `npm run coverage` - Generate test coverage report

## Key Features

- Modern React-based frontend
- Authentication via Auth0
- State management with React Query

## Tech Stack

- React 18
- React Router DOM
- Auth0 React
- React Query
- Vite

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the [MIT License](LICENSE).
