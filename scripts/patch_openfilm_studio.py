with open('client/src/components/Artifacts/OpenFilm/OpenFilmStudio.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = """        // Derive project name and media from artifact title / content
        const rawContent = (currentCode || artifact.content || '').trim();
        const cleanTitle = (artifact.title || 'DawnValley')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 32) || 'DawnValley';
        
        let mediaParam = '';
        const matchMedia = rawContent.match(/src=["']([^"']+\\.(?:mp4|webm))["']/i) || rawContent.match(/(?:https?:\\/\\/[^\\s]+|\\/[^\\s]+\\.(?:mp4|webm))/i);
        if (matchMedia && matchMedia[1]) {
          mediaParam = `&media=${encodeURIComponent(matchMedia[1])}`;
        } else if (matchMedia && matchMedia[0]) {
          mediaParam = `&media=${encodeURIComponent(matchMedia[0])}`;
        }
        
        const url = `/api/openfilm/project-sync?name=${encodeURIComponent(cleanTitle)}${mediaParam}${token ? `&token=${encodeURIComponent(token)}` : ''}`;"""

replacement = """        // Derive project name and media from artifact title / content / id
        const rawContent = (currentCode || artifact.content || '').trim();
        const baseTitle = (artifact.title || 'FilmProject')
          .replace(/[^a-zA-Z0-9_-]/g, '')
          .slice(0, 24) || 'FilmProject';
        const idSuffix = (artifact.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(-8);
        const cleanTitle = idSuffix ? `${baseTitle}_${idSuffix}` : baseTitle;
        
        let mediaParam = '';
        const matchMedia = rawContent.match(/src=["']([^"']+\\.(?:mp4|webm))["']/i) ||
          rawContent.match(/(?:https?:\\/\\/[^\\s"'<>]+|\\/[^\\s"'<>]+)(?:\\.(?:mp4|webm))/i) ||
          rawContent.match(/([a-zA-Z0-9_\\-]+\\.(?:mp4|webm))/i);
        if (matchMedia && matchMedia[1]) {
          mediaParam = `&media=${encodeURIComponent(matchMedia[1])}`;
        } else if (matchMedia && matchMedia[0]) {
          mediaParam = `&media=${encodeURIComponent(matchMedia[0])}`;
        }
        
        const url = `/api/openfilm/project-sync?name=${encodeURIComponent(cleanTitle)}${mediaParam}${token ? `&token=${encodeURIComponent(token)}` : ''}`;"""

if target in text:
    new_text = text.replace(target, replacement)
    new_text = new_text.replace('[artifact.title, artifact.content, currentCode, token]', '[artifact.id, artifact.title, artifact.content, currentCode, token]')
    with open('client/src/components/Artifacts/OpenFilm/OpenFilmStudio.tsx', 'w', encoding='utf-8') as f:
        f.write(new_text)
    print("Updated OpenFilmStudio.tsx successfully!")
else:
    print("Target string not matched in OpenFilmStudio.tsx")
