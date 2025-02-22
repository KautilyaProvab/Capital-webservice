export function ModuleEnabled<T extends { new(...args: any[]): {} }>(constructor: T) {
    const modules = {db: true, BookingDotComService: true}
    if (!modules[constructor.name]) {
        const methods = Reflect.ownKeys(constructor.prototype).filter(t => t != 'constructor');
        for (let i in methods) {
            if (typeof constructor.prototype[methods[i]] == "function") {
                constructor.prototype[methods[i]] = () => [];
            }
        }
    }
    return class extends constructor { }
}