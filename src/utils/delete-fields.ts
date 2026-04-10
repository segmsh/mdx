const positionFields: string[] = ["start", "end", "offset", "range", "loc"]

export function deletePositionFields(obj:any) {
    if (Array.isArray(obj)) {
        for (let i = 0; i < obj.length; i++) {
            deletePositionFields(obj[i]);
        }
    } else if (typeof obj === 'object') {
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                if (positionFields.includes(key)) {
                    delete obj[key];
                } else {
                    deletePositionFields(obj[key]);
                }
            }
        }
    }
}
