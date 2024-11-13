# Syncron

### Syncron is a command-line tool for synchronizing data between different databases.

## Installation

To install `syncron` globally, run the following command:

```bash
npm install -g syncron
```

## Usage
- To use `syncron`, run the following command in your terminal:

    ```
    syncron sync <source-uri> <destination-uri>
    ```

    Replace `<source-uri>` and `<destination-uri>` with the appropriate database connection URIs for your source and destination databases.

- To see the list of available adapters, run the following command in your terminal:
  
    ```
    syncron list-adapters
    ```

## Development
To work on the syncron project, follow these steps:

1. Clone the repository:
    ```
    git clone https://github.com/your-username/syncron.git
    ```

2. Install dependencies:
    ```
    cd syncron
    pnpm install
    ```

3. Start the development server:
    ```
    pnpm dev
    ```

This will start the development server and automatically rebuild and relink the package whenever you make changes to the source files.

## Contributing
Contributions to the `syncron` project are welcome! If you find a bug or have a feature request, please open an issue on the GitHub repository.

## License
This project is licensed under the ISC License.