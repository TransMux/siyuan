import translate from "translate";


export async function translateText(origin: string) {
    return translate(origin, {
        from: "en",
        to: "zh",
    });
}
