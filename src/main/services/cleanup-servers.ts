export async function cleanupDuplicateServers() {
    try {
        // Check for duplicates first
        const duplicates = await (window as any).electronAPI?.git?.getDuplicateServers();
        
        if (!duplicates || duplicates.length === 0) {
            alert('No duplicate servers found.');
            return;
        }

        // Show duplicates info
        const duplicateInfo = duplicates.map((group: any) => 
            `${group.baseUrl}: ${group.count} duplicates`
        ).join('\n');
        
        const proceed = confirm(`Found duplicate servers:\n${duplicateInfo}\n\nProceed with cleanup?`);
        
        if (proceed) {
            // Perform cleanup
            const result = await (window as any).electronAPI?.git?.cleanupDuplicateServers();
            alert(`Cleanup completed:\n- Removed: ${result?.removed || 0} servers\n- Kept: ${result?.kept || 0} servers`);
        }
    } catch (error) {
        console.error('Error during server cleanup:', error);
        alert('Error occurred during server cleanup. Check console for details.');
    }
}