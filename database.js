// database.js
// Tento soubor obsahuje logiku pro připojení k Supabase a funkce pro práci s daty.

// !!! DŮLEŽITÉ: Změň tyto zástupné hodnoty za tvé skutečné Supabase URL a Public Key !!!
// Tyto hodnoty si zkopíruj z tvého Supabase projektu (Project Settings -> API).
const SUPABASE_URL = 'https://aknjpurxdbtsxillmqbd.supabase.co'; 
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFrbmpwdXJ4ZGJ0c3hpbGxtcWJkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDgxOTEzMzAsImV4cCI6MjA2Mzc2NzMzMH0.otk-74BBM-SwC_zA0WqcwGVab5lBfrLiyeYOmh4Xio';

let supabase; // Deklarujeme proměnnou supabase, bude inicializována později

// Funkce pro inicializaci Supabase klienta.
// Tato funkce je volána z hlavního skriptu, až když je knihovna Supabase zaručeně načtena.
window.initializeSupabaseClient = function() {
    // Kontrolujeme, zda je globální objekt Supabase dostupný a zda má metodu createClient.
    if (typeof window.Supabase !== 'undefined' && typeof window.Supabase.createClient === 'function') {
        supabase = window.Supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
        console.log("Supabase klient inicializován v database.js.");
        return true; // Signalizuje úspěšnou inicializaci
    } else {
        console.error("Knihovna Supabase není plně načtena při pokusu o inicializaci v database.js.");
        return false; // Signalizuje neúspěšnou inicializaci
    }
};

// Funkce pro uložení dat do Supabase
// Tato funkce je zpřístupněna globálně pod window.saveWeightLogToSupabase
window.saveWeightLogToSupabase = async function(data) {
    // Zkontrolujeme, zda je Supabase klient inicializován před použitím
    if (!supabase) {
        console.error("Supabase klient není inicializován, nelze uložit data.");
        throw new Error("Supabase klient není připraven k uložení dat.");
    }

    // Převedeme data z camelCase na snake_case, aby odpovídala databázi
    const formattedData = data.map(entry => ({
        date: entry.date,
        weight: entry.weight,
        body_fat: entry.bodyFat,
        muscle_mass: entry.muscleMass,
        body_water: entry.bodyWater,
        manual_bmr: entry.manualBMR,
        manual_amr: entry.manualAMR,
        notes: entry.notes
        // Pokud bys měl autentizaci, přidal bys sem i user_id
    }));

    try {
        // Používáme upsert pro aktualizaci existujících záznamů (na základě 'date') nebo vložení nových.
        const { data: insertedData, error } = await supabase
            .from('weight_entries') // Název tvé tabulky v Supabase
            .upsert(formattedData, { onConflict: 'date' }); 

        if (error) {
            console.error('Chyba při ukládání dat do Supabase:', error.message);
            throw error;
        }
        console.log('Data úspěšně uložena do Supabase:', insertedData);
        return insertedData;
    } catch (err) {
        console.error('Nastala chyba při ukládání do Supabase:', err);
        throw err;
    }
};

// Funkce pro načtení dat ze Supabase
// Tato funkce je zpřístupněna globálně pod window.loadWeightLogFromSupabase
window.loadWeightLogFromSupabase = async function() {
    // Zkontrolujeme, zda je Supabase klient inicializován před použitím
    if (!supabase) {
        console.error("Supabase klient není inicializován, nelze načíst data.");
        return []; // Vrať prázdné pole v případě, že klient není připraven
    }

    try {
        const { data, error } = await supabase
            .from('weight_entries') // Název tvé tabulky v Supabase
            .select('*')
            .order('date', { ascending: true }); // Řazení podle data

        if (error) {
            console.error('Chyba při načítání dat ze Supabase:', error.message);
            throw error;
        }

        // Převedeme klíče zpět na camelCase a parsujeme numerické hodnoty
        const loadedData = data.map(entry => ({
            date: entry.date,
            weight: parseFloat(entry.weight), // Supabase vrací numeric jako string, proto parsujeme
            bodyFat: entry.body_fat ? parseFloat(entry.body_fat) : null,
            muscleMass: entry.muscle_mass ? parseFloat(entry.muscle_mass) : null,
            bodyWater: entry.body_water ? parseFloat(entry.body_water) : null,
            manualBMR: entry.manual_bmr || null,
            manualAMR: entry.manual_amr || null,
            notes: entry.notes || ''
        }));
        
        console.log('Data úspěšně načtena ze Supabase:', loadedData);
        return loadedData;
    } catch (err) {
        console.error('Nastala chyba při načítání ze Supabase:', err);
        return []; // Vrať prázdné pole v případě chyby
    }
};
