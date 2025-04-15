import { body } from "express-validator";

/**
 * Validation rules for the manageBus endpoint.
 */
const manageBusValidation = () => {
  return [
    // 1. opsMode: Always required, must be one of the allowed values
    body("opsMode")
      .trim()
      .notEmpty()
      .withMessage("opsMode is required.")
      .isIn(["INSERT", "UPDATE", "DELETE"])
      .withMessage("opsMode must be INSERT, UPDATE, or DELETE."),

    // 2. busOwnerId: Required only for INSERT
    body("busOwnerId")
      .if(body("opsMode").equals("INSERT")) // Apply validation only if opsMode is INSERT
      .notEmpty()
      .withMessage("busOwnerId is required for INSERT.")
      .isInt({ min: 1 })
      .withMessage("busOwnerId must be a positive integer.")
      .toInt(), // Convert valid integer string to number

    // 3. registrationNumber: Required for INSERT, optional for UPDATE (but validated if present)
    body("registrationNumber")
      .if(body("opsMode").equals("INSERT")) // Apply validation only if opsMode is INSERT
      .trim()
      .notEmpty()
      .withMessage("registrationNumber is required for INSERT.")
      .isLength({ min: 3, max: 100 })
      .withMessage("registrationNumber must be between 3 and 100 characters."),

    body("registrationNumber")
      .if(body("opsMode").equals("UPDATE")) // Apply validation only if opsMode is UPDATE
      .optional({ nullable: true }) // Allow null (meaning don't update), but not undefined/missing by default unless explicitly null
      .trim()
      // If present (not null/omitted), it must not be empty and meet length requirements
      .notEmpty()
      .withMessage(
        "registrationNumber cannot be an empty string if provided for update."
      )
      .isLength({ min: 3, max: 100 })
      .withMessage("registrationNumber must be between 3 and 100 characters."),

    // 4. model: Optional for INSERT/UPDATE
    body("model")
      .if(body("opsMode").isIn(["INSERT", "UPDATE"])) // Apply only for INSERT or UPDATE
      .optional({ nullable: true, checkFalsy: true }) // Allow null or empty string "" to be omitted
      .trim()
      .isLength({ max: 100 })
      .withMessage("model cannot exceed 100 characters."),

    // 5. capacity: Optional for INSERT/UPDATE
    body("capacity")
      .if(body("opsMode").isIn(["INSERT", "UPDATE"])) // Apply only for INSERT or UPDATE
      .optional({ nullable: true }) // Allow null or omitted
      .isInt({ min: 1 })
      .withMessage("capacity must be a positive integer if provided.")
      .toInt(), // Convert valid integer string to number

    // 6. busIdToModify: Required for UPDATE/DELETE
    body("busIdToModify")
      .if(body("opsMode").isIn(["UPDATE", "DELETE"])) // Apply only for UPDATE or DELETE
      .notEmpty()
      .withMessage("busIdToModify is required for UPDATE or DELETE.")
      .isInt({ min: 1 })
      .withMessage("busIdToModify must be a positive integer.")
      .toInt(), // Convert valid integer string to number

    // 7. routes: Optional for INSERT/UPDATE, must be array if present, validate elements
    body("routes")
      .if(body("opsMode").isIn(["INSERT", "UPDATE"])) // Apply only for INSERT or UPDATE
      .optional({ nullable: true }) // Allow null or omitted. Procedure handles null/empty array.
      .isArray()
      .withMessage("routes must be an array if provided.")
      // Custom validation for the elements within the array
      .custom((routesArray) => {
        // If routes is explicitly null or an empty array, it's considered valid at this stage.
        // The procedure logic determines how to handle null (ignore) or empty (delete existing).
        if (!routesArray || routesArray.length === 0) {
          return true;
        }

        // If it's a non-empty array, validate each route object.
        for (let i = 0; i < routesArray.length; i++) {
          const route = routesArray[i];

          if (typeof route !== "object" || route === null) {
            throw new Error(`Route element at index ${i} must be an object.`);
          }

          // -- Validate individual fields within the route object --

          // sequence_order: Required, non-negative integer
          if (
            route.sequence_order === undefined ||
            route.sequence_order === null ||
            !Number.isInteger(route.sequence_order) ||
            route.sequence_order < 0
          ) {
            throw new Error(
              `Route element at index ${i} requires a non-negative integer 'sequence_order'.`
            );
          }

          // from_location: Required, non-empty string, max length
          if (
            !route.from_location ||
            typeof route.from_location !== "string" ||
            route.from_location.trim().length === 0
          ) {
            throw new Error(
              `Route element at index ${i} requires a non-empty string 'from_location'.`
            );
          }
          if (route.from_location.length > 255) {
            throw new Error(
              `Route element at index ${i} 'from_location' cannot exceed 255 characters.`
            );
          }

          // to_location: Required, non-empty string, max length
          if (
            !route.to_location ||
            typeof route.to_location !== "string" ||
            route.to_location.trim().length === 0
          ) {
            throw new Error(
              `Route element at index ${i} requires a non-empty string 'to_location'.`
            );
          }
          if (route.to_location.length > 255) {
            throw new Error(
              `Route element at index ${i} 'to_location' cannot exceed 255 characters.`
            );
          }

          // location_name: Optional, string, max length
          if (
            route.location_name !== undefined &&
            route.location_name !== null
          ) {
            if (typeof route.location_name !== "string") {
              throw new Error(
                `Route element at index ${i} 'location_name' must be a string if provided.`
              );
            }
            if (route.location_name.length > 255) {
              throw new Error(
                `Route element at index ${i} 'location_name' cannot exceed 255 characters.`
              );
            }
          }

          // start_time: Optional, string in HH:MM or HH:MM:SS format
          if (route.start_time !== undefined && route.start_time !== null) {
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/; // Regex for HH:MM or HH:MM:SS
            if (
              typeof route.start_time !== "string" ||
              !timeRegex.test(route.start_time)
            ) {
              throw new Error(
                `Route element at index ${i} 'start_time' must be a valid time string (HH:MM or HH:MM:SS) if provided.`
              );
            }
          }

          // end_time: Optional, string in HH:MM or HH:MM:SS format
          if (route.end_time !== undefined && route.end_time !== null) {
            const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/; // Regex for HH:MM or HH:MM:SS
            if (
              typeof route.end_time !== "string" ||
              !timeRegex.test(route.end_time)
            ) {
              throw new Error(
                `Route element at index ${i} 'end_time' must be a valid time string (HH:MM or HH:MM:SS) if provided.`
              );
            }
          }
        } // End for loop

        // Optional: Check for duplicate sequence_order within the submitted array
        const sequenceNumbers = routesArray.map((r) => r.sequence_order);
        const uniqueSequenceNumbers = new Set(sequenceNumbers);
        if (sequenceNumbers.length !== uniqueSequenceNumbers.size) {
          throw new Error(
            "Duplicate 'sequence_order' values found within the submitted routes array."
          );
        }

        return true; // All elements in the array are valid
      }),
  ];
};

export { manageBusValidation };
