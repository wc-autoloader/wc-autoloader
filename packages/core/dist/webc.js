export async function load(path) {
    const module = await import(path);
    return module.default;
}
